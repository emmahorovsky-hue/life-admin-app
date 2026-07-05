import axios from 'axios';

// Server errors follow ErrorResponse ({ error: { message } }) — surface that
// message when present, otherwise the caller's fallback.
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error?.message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}
