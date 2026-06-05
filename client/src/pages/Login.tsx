import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Form column */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link
            to="/"
            className="text-xl font-black transition-opacity hover:opacity-70"
            aria-label={`${APP_NAME} home`}
          >
            {APP_NAME}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Sign in to your account to continue
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                Create an account
              </button>
            </p>
          </form>
        </div>
      </div>

      {/* Illustration column */}
      <div className="relative hidden bg-muted lg:block">
        <img
          src="/hero-desk.webp"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
