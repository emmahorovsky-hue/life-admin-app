import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { APP_NAME } from '@/lib/constants';

export default function TermsOfService() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: [Date]</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] By accessing or using {APP_NAME}, you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] {APP_NAME} provides a subscription and document management service that
              allows users to track subscriptions, contracts, warranties, and other recurring
              commitments. The service is provided "as is" and may be updated or changed at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] You are responsible for maintaining the confidentiality of your account
              credentials and for all activities that occur under your account. You must notify us
              immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] You agree to use {APP_NAME} only for lawful purposes and in accordance
              with these Terms. You must not use the service in any way that could damage, disable,
              or impair the service or interfere with other users.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] All content, features, and functionality of {APP_NAME} are owned by us
              and are protected by intellectual property laws. You may not copy, modify, or
              distribute any part of the service without our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] To the fullest extent permitted by law, {APP_NAME} shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your use
              of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We reserve the right to suspend or terminate your account at any time
              for any reason, including violation of these Terms. You may also delete your account
              at any time from your profile settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We may update these Terms from time to time. We will notify you of
              significant changes by email or through the service. Your continued use of {APP_NAME}
              after changes take effect constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] If you have any questions about these Terms, please contact us at
              [contact@paypr.com].
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto max-w-3xl px-4 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <div className="flex gap-4">
            <Link to="/privacy" onClick={() => window.scrollTo(0, 0)} className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link to="/" onClick={() => window.scrollTo(0, 0)} className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
