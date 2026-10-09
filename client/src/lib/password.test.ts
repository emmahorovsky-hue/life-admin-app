import { describe, it, expect } from 'vitest';
import { PASSWORD_RULES, isValidPassword, passwordRuleResults } from '@life-admin/shared';

const met = (pw: string) =>
  Object.fromEntries(passwordRuleResults(pw).map((r) => [r.id, r.met]));

describe('password rules', () => {
  it('reports each rule separately', () => {
    expect(met('')).toEqual({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      symbol: false,
    });
    expect(met('abcdefgh')).toEqual({
      length: true,
      uppercase: false,
      lowercase: true,
      number: false,
      symbol: false,
    });
    expect(met('A1!')).toEqual({
      length: false,
      uppercase: true,
      lowercase: false,
      number: true,
      symbol: true,
    });
  });

  it('requires a lowercase letter, matching the server default', () => {
    // The server's isStrongPassword keeps validator's minLowercase: 1 default.
    expect(met('PASSWORD1!').lowercase).toBe(false);
    expect(isValidPassword('PASSWORD1!')).toBe(false);
  });

  it('does not count whitespace as a symbol', () => {
    expect(met('Abcdefg1 ').symbol).toBe(false);
  });

  it('counts only symbols the server accepts', () => {
    // '€' is outside validator's isStrongPassword symbol list, so the server
    // would reject it as the only symbol; the checklist must not tick for it.
    expect(met('Abcdefg1€').symbol).toBe(false);
    for (const symbol of '-#!$@£%^&*()_+|~=`{}[]:";\'<>?,./\\') {
      expect(met(`Abcdefg1${symbol}`).symbol).toBe(true);
    }
  });

  it('isValidPassword is exactly "every rule met"', () => {
    for (const pw of ['', 'Ab1!def', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdefg1', 'Str0ng!pass']) {
      expect(isValidPassword(pw)).toBe(PASSWORD_RULES.every((r) => r.test(pw)));
    }
    expect(isValidPassword('Str0ng!pass')).toBe(true);
  });
});
