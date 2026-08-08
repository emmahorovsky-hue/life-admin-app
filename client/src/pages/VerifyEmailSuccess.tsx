import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { IconCheck } from '@/components/icons';

const VerifyEmailSuccess: React.FC = () => {
  // Most people land here from an email link in a logged-out browser, where
  // /dashboard would only bounce them to /login via ProtectedRoute.
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 bg-accent rounded-full flex items-center justify-center">
            {/* ink="inherit": the glyph is already tinted success-green, and a
                brand-orange accent inside it would read as a second state. */}
            <IconCheck className="w-8 h-8 text-success" ink="inherit" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Email verified</h1>
        <p className="text-muted-foreground mb-6">You're all set. Your email has been successfully verified.</p>
        {!loading && (
          <Link
            to={user ? '/dashboard' : '/login'}
            className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary-hover transition"
          >
            {user ? 'Continue to app' : 'Log in'}
          </Link>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailSuccess;
