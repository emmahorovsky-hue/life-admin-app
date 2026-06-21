import { Link } from 'react-router-dom';
import { APP_NAME } from '@/lib/constants';

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Illustration shown in the right column. Defaults to the auth desk image. */
  illustration?: string;
}

/**
 * Two-column auth shell (signup-02 layout): form on the left, desk
 * illustration on the right. The illustration drops away below `lg`,
 * leaving a centered form for mobile/tablet.
 */
export default function AuthLayout({ children, illustration = '/hero-auth.webp' }: AuthLayoutProps) {
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
        <div className="flex flex-1 items-center justify-center">{children}</div>
      </div>

      {/* Illustration column */}
      <div className="relative hidden bg-muted lg:block">
        <img
          src={illustration}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none select-none absolute inset-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );
}
