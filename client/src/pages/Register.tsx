import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isValidPassword } from '@life-admin/shared';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordRequirements } from '@/components/ui/password-requirements';
import { useConfirmPassword } from '@/hooks/useConfirmPassword';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/components/AuthLayout';
import { getApiErrorMessage } from '@/lib/utils';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const confirm = useConfirmPassword(password, confirmPassword);
  const passwordInvalid = submitted && !isValidPassword(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Both problems show on their own fields; the banner is for the server.
    setSubmitted(true);
    confirm.reveal();
    if (!isValidPassword(password) || confirm.mismatch) return;

    setLoading(true);

    try {
      await register(email, password, undefined);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout illustration="/hero-desk.webp" hideLegalFooter>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Get started in just a few seconds
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              aria-invalid={passwordInvalid || undefined}
              aria-describedby="password-requirements"
            />
            <PasswordRequirements id="password-requirements" password={password} showErrors={passwordInvalid} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={loading}
              {...confirm.confirmProps}
            />
            {confirm.error && (
              <p id={confirm.errorId} className="text-xs text-destructive">
                {confirm.error}
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
