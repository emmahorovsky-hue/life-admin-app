import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { resendVerification } from '@/lib/api';

export const UnverifiedEmailBanner: React.FC = () => {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (!user || user.emailVerified) {
    return null;
  }

  const handleResend = async () => {
    if (resending || countdown > 0) return;

    setResending(true);
    try {
      await resendVerification(user.email);
      setResent(true);
      setCountdown(60);

      // Countdown timer
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to resend verification:', error);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-yellow-800">
            📧 <strong>Verify your email.</strong> We sent a link to{' '}
            <strong>{user.email}</strong>.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="text-sm text-yellow-900 underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0
              ? `Resend (${countdown}s)`
              : resent
              ? 'Sent — check your inbox'
              : 'Resend'}
          </button>
        </div>
      </div>
    </div>
  );
};
