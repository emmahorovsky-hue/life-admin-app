import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { APP_NAME } from '@/lib/constants';

// --- Update this before publishing -------------------------------------------
// CONTACT_EMAIL: must be a monitored inbox. This is the address the App Store
//   listing's Support URL ultimately points people at, so it cannot go stale.
//   Same inbox as the Terms contact and the Privacy DPO address.
const CONTACT_EMAIL = 'paypr.live@gmail.com';
// -----------------------------------------------------------------------------

/**
 * Public support page (/support).
 *
 * Exists because the App Store requires a reachable Support URL, and a landing
 * page with no contact address anywhere on it does not qualify. Kept outside
 * `<ProtectedRoute>` for the same reason: App Review opens it without signing
 * in, and so does anyone locked out of their account — which is most of the
 * people who need it.
 *
 * Deliberately short. The answers here are the four questions someone actually
 * arrives with; anything longer becomes a knowledge base nobody maintains.
 */
export default function Support() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <Link to="/" aria-label={`${APP_NAME} home`}>
            <Logo height={24} />
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Support</h1>
        <p className="text-muted-foreground leading-relaxed mb-10">
          Something not working, or a question we haven&rsquo;t answered below? Get in touch and
          we&rsquo;ll help.
        </p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">Contact us</h2>
            <p className="text-muted-foreground leading-relaxed">
              Email{' '}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                {CONTACT_EMAIL}
              </a>
              . We aim to reply within a few business days. If you&rsquo;re writing about a problem,
              telling us what you did, what you expected, and what happened instead gets you a
              useful answer far faster.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How do I delete my account?</h2>
            <p className="text-muted-foreground leading-relaxed">
              In {APP_NAME}, go to Settings &rsaquo; Privacy and choose Delete account. You&rsquo;ll
              be asked for your password to confirm. Deletion is immediate and permanent: your
              subscriptions, uploaded images, and account details are removed, and we cannot
              recover them afterwards.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How do renewal reminders work?</h2>
            <p className="text-muted-foreground leading-relaxed">
              We flag each subscription ahead of its renewal date so nothing charges you by
              surprise. Reminders can arrive by email, or as a push notification on the mobile app.
              Both are optional and can be turned on or off in Settings &rsaquo; Notifications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">I&rsquo;ve forgotten my password</h2>
            <p className="text-muted-foreground leading-relaxed">
              Choose{' '}
              <Link
                to="/forgot-password"
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Forgot password
              </Link>{' '}
              on the sign-in screen and we&rsquo;ll email you a reset link. The link expires after a
              while, so request a fresh one if it no longer works. Note that resetting your password
              signs you out everywhere.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Does {APP_NAME} connect to my bank?</h2>
            <p className="text-muted-foreground leading-relaxed">
              No. {APP_NAME} never connects to your bank or card accounts, never asks for banking
              credentials, and never moves money. You add subscriptions yourself, or scan a receipt
              and we fill in the details for you. What we do and don&rsquo;t collect is set out in
              full in our{' '}
              <Link
                to="/privacy"
                onClick={() => window.scrollTo(0, 0)}
                className="underline underline-offset-4 hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto max-w-3xl px-4 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <div className="flex gap-4">
            <Link
              to="/terms"
              onClick={() => window.scrollTo(0, 0)}
              className="hover:text-foreground transition-colors"
            >
              Terms of Service
            </Link>
            <Link
              to="/privacy"
              onClick={() => window.scrollTo(0, 0)}
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="hover:text-foreground transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
