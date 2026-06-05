import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resendVerification } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const errorMessages: Record<string, { headline: string; body: string; showResend: boolean }> = {
  invalid: {
    headline: 'Link invalid',
    body: 'This verification link is invalid.',
    showResend: true,
  },
  expired: {
    headline: 'Link expired',
    body: 'This link has expired. Verification links last 24 hours.',
    showResend: true,
  },
  already_used: {
    headline: 'Already verified',
    body: 'This email is already verified.',
    showResend: false,
  },
  email_changed: {
    headline: 'Link out of date',
    body: 'This link is no longer valid because your email changed.',
    showResend: true,
  },
};

const VerifyEmailError: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const reason = searchParams.get('reason') || 'invalid';
  const errorInfo = errorMessages[reason] || errorMessages.invalid;

  const [resending, setResending] = React.useState(false);
  const [resent, setResent] = React.useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await resendVerification(user.email);
      setResent(true);
    } catch (error) {
      console.error('Failed to resend verification:', error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{errorInfo.headline}</h1>
        <p className="text-muted-foreground mb-6">{errorInfo.body}</p>
        <div className="flex flex-col gap-3">
          {errorInfo.showResend && user && (
            <button
              onClick={handleResend}
              disabled={resending || resent}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary-hover transition disabled:opacity-50"
            >
              {resent ? 'Sent — check your inbox' : resending ? 'Sending...' : 'Resend verification'}
            </button>
          )}
          {reason === 'already_used' && (
            <Link
              to="/login"
              className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary-hover transition"
            >
              Log in
            </Link>
          )}
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailError;
