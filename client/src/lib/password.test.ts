import { describe, it, expect } from 'vitest';
import { PASSWORD_RULES, isValidPassword, passwordRuleResults } from '@life-admin/shared';

const met = (pw: string) =>
  Object.fromEntries(passwordRuleResults(pw).map((r) => [r.id, r.met]));

describe('password rules', () => {
  it('reports each rule separately', () => {
    expect(met('')).toEqual({ length: false, uppercase: false, number: false, symbol: false });
    expect(met('abcdefgh')).toEqual({ length: true, uppercase: false, number: false, symbol: false });
    expect(met('A1!')).toEqual({ length: false, uppercase: true, number: true, symbol: true });
  });

  it('does not count whitespace as a symbol', () => {
    expect(met('Abcdefg1 ').symbol).toBe(false);
  });

  it('isValidPassword is exactly "every rule met"', () => {
    for (const pw of ['', 'Ab1!def', 'abcdef1!', 'Abcdefg!', 'Abcdefg1', 'Str0ng!pass']) {
      expect(isValidPassword(pw)).toBe(PASSWORD_RULES.every((r) => r.test(pw)));
    }
    expect(isValidPassword('Str0ng!pass')).toBe(true);
  });
});
