export interface PasswordRule {
  id: 'length' | 'uppercase' | 'number' | 'symbol';
  /** Short label for a live checklist, e.g. "At least 8 characters". */
  label: string;
  test: (password: string) => boolean;
}

// The one definition of a valid password. `isValidPassword` is the AND of these,
// and the web forms render them as a live checklist, so the rule a user sees is
// the rule that is enforced.
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'One symbol', test: (pw) => /[^a-zA-Z0-9\s]/.test(pw) },
];

export function passwordRuleResults(
  password: string
): Array<Pick<PasswordRule, 'id' | 'label'> & { met: boolean }> {
  return PASSWORD_RULES.map(({ id, label, test }) => ({ id, label, met: test(password) }));
}

export function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
