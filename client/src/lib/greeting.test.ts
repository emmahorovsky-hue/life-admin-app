import { describe, it, expect } from 'vitest';
import { greeting } from './greeting';

const NOW = new Date('2026-10-09T12:00:00Z').getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

describe('greeting', () => {
  it('says "Welcome" to an account created in the last day', () => {
    expect(greeting({ name: null, createdAt: hoursAgo(1) }, NOW)).toBe('Welcome');
  });

  it('says "Welcome back" once the account is a day old', () => {
    expect(greeting({ name: null, createdAt: hoursAgo(25) }, NOW)).toBe('Welcome back');
  });

  it('adds the name only when one is set', () => {
    expect(greeting({ name: 'Ada', createdAt: hoursAgo(48) }, NOW)).toBe('Welcome back, Ada');
    expect(greeting({ name: '  ', createdAt: hoursAgo(48) }, NOW)).toBe('Welcome back');
  });

  it('falls back to "Welcome back" without a user or creation date', () => {
    expect(greeting(null, NOW)).toBe('Welcome back');
    expect(greeting({ name: null, createdAt: '' }, NOW)).toBe('Welcome back');
  });
});
