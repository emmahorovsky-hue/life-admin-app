export interface PasswordRule {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol';
  /** Short label for a live checklist, e.g. "At least 8 characters". */
  label: string;
  test: (password: string) => boolean;
}

// validator.js's isStrongPassword symbol list (what the server's auth routes
// enforce), minus the space it inexplicably includes: a checklist ticking
// "One symbol" for a space would read as a bug, and requiring a listed symbol
// while the server would also take a space only errs toward stronger input.
const SYMBOLS = /[-#!$@£%^&*()_+|~=`{}[\]:";'<>?,./\\]/;

// The one definition of a valid password. `isValidPassword` is the AND of these,
// and the web forms render them as a live checklist, so the rule a user sees is
// the rule that is enforced. Must stay at least as strict as the server's
// isStrongPassword options in server/src/routes/auth.ts — including its
// minLowercase: 1 default — or the checklist shows green for a password the
// server then 400s.
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'symbol', label: 'One symbol', test: (pw) => SYMBOLS.test(pw) },
];

export function passwordRuleResults(
  password: string
): Array<Pick<PasswordRule, 'id' | 'label'> & { met: boolean }> {
  return PASSWORD_RULES.map(({ id, label, test }) => ({ id, label, met: test(password) }));
}

export function isValidPassword(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}
