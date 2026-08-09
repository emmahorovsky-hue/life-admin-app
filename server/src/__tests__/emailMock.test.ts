import * as emailService from '../services/emailService';

// Guards the gap LIF-152 closed: setup.ts used to mock only 2 of the senders.
// The rest stayed silent purely because RESEND_API_KEY is unset in the test env,
// so a real send was one environment variable away. If someone adds a new
// send* export and forgets to mock it, this fails instead of quietly mailing.
describe('email service mock coverage', () => {
  it('mocks every exported send* function', () => {
    const exports = emailService as unknown as Record<string, unknown>;
    const senders = Object.keys(exports).filter((name) => name.startsWith('send'));

    expect(senders.length).toBeGreaterThan(0);

    const unmocked = senders.filter((name) => !jest.isMockFunction(exports[name]));
    expect(unmocked).toEqual([]);
  });

  // The mocks above only cover jest. E2E runs the real server as a separate
  // process where they do not apply, and it is handed a RESEND_API_KEY (a dummy
  // in CI, a real one in a developer's server/.env) — which was enough to
  // construct a live client and put a real HTTPS call to api.resend.com inside
  // registration, slowing it ~5x and flaking the suite. The tests below are the
  // only thing that catches a regression here: the e2e job asserts nothing about
  // email, so there it would resurface as latency, which `retries: 2` absorbs.
  //
  // All three assert against the *actual* module, since the mock would hide the
  // bug, and each re-imports it in isolation because the guard is evaluated once
  // at module load.
  describe('real emailService send guard', () => {
    // Stubs the SDK so the only thing the guard actually decides — whether a
    // client gets constructed at all — is directly observable, and so a
    // regressed guard fails on an assertion instead of by reaching
    // api.resend.com. It matters: with the guard removed and the SDK live,
    // this file took 4.7s instead of 0.3s, and all of that gap was real HTTPS
    // traffic from a unit test.
    //
    // The stub is installed inside the isolated registry because the module
    // reads the environment and constructs its client once, at load.
    function withStubbedResend(
      run: (
        emailService: typeof import('../services/emailService'),
        stub: { Resend: jest.Mock; send: jest.Mock },
      ) => Promise<void>,
    ): Promise<void> {
      const send = jest.fn().mockResolvedValue({ data: { id: 'real-send-id' }, error: null });
      const Resend = jest.fn().mockImplementation(() => ({ emails: { send } }));

      return jest
        .isolateModulesAsync(async () => {
          jest.doMock('resend', () => ({ Resend }));
          const actual = jest.requireActual<typeof import('../services/emailService')>(
            '../services/emailService',
          );
          await run(actual, { Resend, send });
        })
        .finally(() => jest.dontMock('resend'));
    }

    // Restores exactly what was there, including "was not set at all" — a stray
    // RESEND_API_KEY or NODE_ENV leaking out of here would change how every
    // later suite behaves.
    function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void>) {
      const previous = Object.fromEntries(
        Object.keys(overrides).map((key) => [key, process.env[key]]),
      );
      Object.entries(overrides).forEach(([key, value]) => {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      });
      return run().finally(() => {
        Object.entries(previous).forEach(([key, value]) => {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        });
      });
    }

    // The skip path returns this sentinel; a constructed client would instead
    // attempt a send.
    const SKIPPED = { id: 'mock-email-id' };

    const verification = {
      to: 'nobody@example.com',
      verifyUrl: 'http://localhost:3001/verify',
      expiresInHours: 24,
    };

    it('refuses to send under NODE_ENV=test even when RESEND_API_KEY is set', async () => {
      await withEnv({ NODE_ENV: 'test', RESEND_API_KEY: 'test-dummy-key' }, () =>
        withStubbedResend(async (emailService, { Resend, send }) => {
          await expect(emailService.sendVerificationEmail(verification)).resolves.toEqual(SKIPPED);
          expect(Resend).not.toHaveBeenCalled();
          expect(send).not.toHaveBeenCalled();
        }),
      );
    });

    // The local e2e backend is started with `npm run dev`, which leaves NODE_ENV
    // unset. CLAUDE.md's command now exports NODE_ENV=test, but this flag is the
    // escape hatch for a run that wants development semantics everywhere else.
    it('refuses to send when DISABLE_EMAIL_SENDING=true outside production', async () => {
      await withEnv(
        {
          NODE_ENV: 'development',
          RESEND_API_KEY: 'test-dummy-key',
          DISABLE_EMAIL_SENDING: 'true',
        },
        () =>
          withStubbedResend(async (emailService, { Resend, send }) => {
            await expect(emailService.sendVerificationEmail(verification)).resolves.toEqual(SKIPPED);
            expect(Resend).not.toHaveBeenCalled();
            expect(send).not.toHaveBeenCalled();
          }),
      );
    });

    // The flag is a dev convenience, so it must not be able to silence
    // verification and password-reset mail in production if it leaks into the
    // deployed environment (same treatment as DISABLE_RATE_LIMIT). This is also
    // what proves the guard above didn't disable sending outright: with the SDK
    // stubbed, a genuinely intended send still reaches it.
    it('ignores DISABLE_EMAIL_SENDING in production and still sends', async () => {
      await withEnv(
        {
          NODE_ENV: 'production',
          RESEND_API_KEY: 'test-dummy-key',
          DISABLE_EMAIL_SENDING: 'true',
        },
        async () => {
          const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

          try {
            await withStubbedResend(async (emailService, { Resend, send }) => {
              await expect(emailService.sendVerificationEmail(verification)).resolves.toEqual({
                id: 'real-send-id',
              });
              expect(Resend).toHaveBeenCalledWith('test-dummy-key');
              expect(send).toHaveBeenCalledTimes(1);
            });

            expect(warn).toHaveBeenCalledWith(expect.stringContaining('DISABLE_EMAIL_SENDING'));
          } finally {
            warn.mockRestore();
          }
        },
      );
    });
  });
});
