import { useId, useState } from 'react';

/**
 * Inline "Passwords don't match" for a confirm field.
 *
 * Shown once the field has been left (or a submit was attempted), not while the
 * first characters are still going in, and cleared the moment the two match.
 * Spread `confirmProps` on the confirm input and render `error` under it with
 * `id={errorId}`.
 */
export function useConfirmPassword(password: string, confirmPassword: string) {
  const errorId = useId();
  const [touched, setTouched] = useState(false);

  const mismatch = confirmPassword !== '' && confirmPassword !== password;
  const error = touched && mismatch ? "Passwords don't match" : null;

  return {
    error,
    errorId,
    mismatch,
    /** Call on submit so an untouched mismatch still shows. */
    reveal: () => setTouched(true),
    confirmProps: {
      onBlur: () => setTouched(true),
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? errorId : undefined,
    },
  };
}
