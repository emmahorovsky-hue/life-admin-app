import React from 'react';
import { Link } from 'react-router-dom';

const VerifyEmailSuccess: React.FC = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border rounded-lg p-8 text-center">
        <div className="mb-4">
          <div className="mx-auto w-16 h-16 bg-accent rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-success"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Email verified</h1>
        <p className="text-muted-foreground mb-6">You're all set. Your email has been successfully verified.</p>
        <Link
          to="/dashboard"
          className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary-hover transition"
        >
          Continue to app
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailSuccess;
