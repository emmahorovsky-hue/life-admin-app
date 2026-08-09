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
  // process where they do not apply, and CI sets a dummy RESEND_API_KEY — which
  // was enough to construct a live client and put a real HTTPS call to
  // api.resend.com inside registration, slowing it ~5x and flaking the suite.
  // Asserted against the *actual* module, since the mock would hide the bug.
  it('refuses to send under NODE_ENV=test even when RESEND_API_KEY is set', async () => {
    const previous = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 'test-dummy-key';

    try {
      await jest.isolateModulesAsync(async () => {
        const actual = jest.requireActual('../services/emailService');

        // The skip path returns this sentinel; a constructed client would
        // instead attempt a send and reject on the invalid key.
        await expect(
          actual.sendVerificationEmail({
            to: 'nobody@example.com',
            verifyUrl: 'http://localhost:3001/verify',
            expiresInHours: 24,
          }),
        ).resolves.toEqual({ id: 'mock-email-id' });
      });
    } finally {
      if (previous === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = previous;
    }
  });
});
