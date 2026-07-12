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
});
