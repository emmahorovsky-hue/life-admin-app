jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
}));

import * as Sentry from '@sentry/node';
import { reportServerError } from '../utils/reportError';

describe('reportServerError', () => {
  it('reports the error to Sentry tagged with its context', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('boom');

    reportServerError('Register error', error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { context: 'Register error' },
    });
    expect(consoleSpy).toHaveBeenCalledWith('Register error:', error);
    consoleSpy.mockRestore();
  });
});
