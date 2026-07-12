import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { cn, getApiErrorMessage } from './utils';

describe('cn', () => {
  it('joins truthy class values and drops falsy ones', () => {
    // eslint-disable-next-line no-constant-binary-expression -- the constant `false &&` mirrors real `condition && 'class'` call sites; dropping the falsy result is the behavior under test
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c');
  });

  it('dedupes conflicting tailwind utilities (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('getApiErrorMessage', () => {
  it('extracts the API error message from an AxiosError', () => {
    const response = {
      data: { error: { message: 'Email already registered' } },
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosError['response'];
    const err = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response);

    expect(getApiErrorMessage(err, 'fallback')).toBe('Email already registered');
  });

  it('uses the fallback when an AxiosError carries no message', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(getApiErrorMessage(err, 'Something went wrong')).toBe('Something went wrong');
  });

  it('uses the fallback for non-Axios errors', () => {
    expect(getApiErrorMessage(new Error('boom'), 'fallback')).toBe('fallback');
    expect(getApiErrorMessage('nope', 'fallback')).toBe('fallback');
  });
});
