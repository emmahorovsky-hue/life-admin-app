import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { resendVerification } from '@/lib/api';

// Unverified accounts are deleted after this many days (mirrors the server's
// GRACE_PERIOD_DAYS in accountCleanupService).
const GRACE_PERIOD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const UnverifiedEmailBanner: React.FC = () => {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  if (!user || user.emailVerified) {
    return null;
  }

  const daysElapsed = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / MS_PER_DAY);
  const daysLeft = Math.max(0, GRACE_PERIOD_DAYS - daysElapsed);
  const deletionWarning =
    daysLeft > 0
      ? `Verify within ${daysLeft} day${daysLeft === 1 ? '' : 's'} or your account will be deleted.`
      : 'Your account will be deleted soon — verify now to keep it.';

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
    <div className="bg-accent border-b border-border border-l-4 border-l-brand-orange px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-foreground">
            📧 <strong>Verify your email.</strong> We sent a link to{' '}
            <strong>{user.email}</strong>. {deletionWarning}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="text-sm text-foreground underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
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
