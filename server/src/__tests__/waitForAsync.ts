// Waiting for work an endpoint deliberately does *after* it responds.
//
// Several auth routes answer immediately and finish in a detached promise —
// `issuePasswordResetToken(...).catch(...)` in authController, and the
// verification-token issue on register. Each is two database round trips
// followed by a send.
//
// Tests used to wait for those with a flat `setTimeout(r, 100)`, which is a
// guess about how long two round trips take. On a loaded CI runner they don't
// reliably fit, and the password-reset specs failed intermittently with
// "Expected number of calls: 1, Received number of calls: 0" — a red build with
// nothing wrong in the code, and no way to tell it apart from a real one.
//
// Polling removes the guess. It returns as soon as the effect lands — single-
// digit milliseconds in the normal case, so the suite gets slightly *faster*
// than the fixed sleeps it replaces — and spends the full budget only when
// something is genuinely broken. The budget sits under jest's 10s testTimeout so
// a real failure reports what it was waiting for instead of dying as a timeout.

const DEFAULT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 10;

/** Resolve once `predicate` holds, or throw naming what never happened. */
export async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  description = 'condition',
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** Structural, so it takes a `jest.fn()` and a `jest.spyOn()` handle alike. */
type CallRecorder = { mock: { calls: unknown[] } };

/**
 * Resolve once a mocked sender has been called. Sends are the last step of the
 * detached work, so this also means its database writes have landed — assert on
 * those straight after.
 */
export function waitForCall(
  mock: CallRecorder,
  label = 'a mocked sender',
  times = 1
): Promise<void> {
  return waitUntil(
    () => mock.mock.calls.length >= times,
    `${label} to be called ${times === 1 ? 'once' : `${times} times`}`
  );
}
