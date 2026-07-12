jest.mock('@sentry/node', () => ({
  isInitialized: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

import { Request } from 'express';
import * as Sentry from '@sentry/node';
import { logSecurityEvent } from '../securityLog';

const mockedSentry = Sentry as jest.Mocked<typeof Sentry>;

const fakeReq = {
  ip: '203.0.113.7',
  get: jest.fn((header: string) => (header.toLowerCase() === 'user-agent' ? 'jest-agent/1.0' : undefined)),
} as unknown as Request;

describe('logSecurityEvent', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  const lastLoggedEntry = () => JSON.parse(logSpy.mock.calls[logSpy.mock.calls.length - 1][0]);

  it('emits a single structured JSON line with event, request, and detail fields', () => {
    mockedSentry.isInitialized.mockReturnValue(false);

    logSecurityEvent('auth.login.failure', fakeReq, {
      userId: 'user-1',
      email: 'user@example.com',
      reason: 'invalid_password',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = lastLoggedEntry();
    expect(entry).toEqual({
      type: 'security_event',
      event: 'auth.login.failure',
      timestamp: expect.any(String),
      ip: '203.0.113.7',
      userAgent: 'jest-agent/1.0',
      userId: 'user-1',
      email: 'user@example.com',
      reason: 'invalid_password',
    });
    expect(new Date(entry.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('omits undefined detail fields from the log line', () => {
    mockedSentry.isInitialized.mockReturnValue(false);

    logSecurityEvent('auth.email_verification.failure', fakeReq, { reason: 'expired' });

    const entry = lastLoggedEntry();
    expect(entry).not.toHaveProperty('userId');
    expect(entry).not.toHaveProperty('email');
    expect(entry.reason).toBe('expired');
  });

  it('does not touch Sentry when it is not initialized', () => {
    mockedSentry.isInitialized.mockReturnValue(false);

    logSecurityEvent('auth.rate_limit.exceeded', fakeReq, { route: '/api/auth/login' });

    expect(mockedSentry.addBreadcrumb).not.toHaveBeenCalled();
    expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
  });

  it('adds a breadcrumb for routine events without capturing a message', () => {
    mockedSentry.isInitialized.mockReturnValue(true);

    logSecurityEvent('auth.login.success', fakeReq, { userId: 'user-1', email: 'user@example.com' });

    expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'security',
      message: 'auth.login.success',
      level: 'info',
      data: { userId: 'user-1' },
    });
    expect(mockedSentry.captureMessage).not.toHaveBeenCalled();
  });

  it('captures a Sentry message for high-signal events', () => {
    mockedSentry.isInitialized.mockReturnValue(true);

    logSecurityEvent('auth.rate_limit.exceeded', fakeReq, {
      route: '/api/auth/login',
      reason: 'per_ip_hourly',
    });

    expect(mockedSentry.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'security', message: 'auth.rate_limit.exceeded', level: 'warning' })
    );
    expect(mockedSentry.captureMessage).toHaveBeenCalledWith('Security event: auth.rate_limit.exceeded', {
      level: 'warning',
      tags: { securityEvent: 'auth.rate_limit.exceeded', route: '/api/auth/login' },
      extra: { reason: 'per_ip_hourly' },
    });
  });

  it('never sends email or IP to Sentry (sendDefaultPii is false by design)', () => {
    mockedSentry.isInitialized.mockReturnValue(true);

    logSecurityEvent('auth.rate_limit.exceeded', fakeReq, {
      userId: 'user-1',
      email: 'user@example.com',
      route: '/api/auth/login',
    });

    const sentryPayloads = JSON.stringify([
      mockedSentry.addBreadcrumb.mock.calls,
      mockedSentry.captureMessage.mock.calls,
    ]);
    expect(sentryPayloads).not.toContain('user@example.com');
    expect(sentryPayloads).not.toContain('203.0.113.7');
  });
});
