import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { APP_NAME } from '@/lib/constants';

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: [Date]</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We collect information you provide directly to us, such as your email
              address and password when you create an account, and the subscription and document
              data you enter into {APP_NAME}.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We use the information we collect to provide, maintain, and improve
              {APP_NAME}, to send you renewal reminders and service notifications, and to respond
              to your requests and questions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We do not sell, trade, or otherwise transfer your personal information
              to third parties without your consent, except as required by law or to provide the
              service (e.g., our email delivery provider).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] Your data is stored securely on our servers. We implement appropriate
              technical and organisational measures to protect your personal information against
              unauthorised access, loss, or disclosure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We use cookies to keep you logged in. We do not use cookies for
              advertising or tracking purposes. You can control cookies through your browser
              settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] You have the right to access, correct, or delete your personal
              information. You can update your account details from your profile settings or
              contact us to request deletion of your account and associated data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We retain your data for as long as your account is active. If you
              delete your account, we will delete or anonymise your personal data within
              [timeframe], except where we are required to retain it by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] We may update this Privacy Policy from time to time. We will notify
              you of significant changes by email. Your continued use of {APP_NAME} after changes
              take effect constitutes your acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              [Placeholder] If you have any questions about this Privacy Policy or how we handle
              your data, please contact us at [contact@paypr.com].
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto max-w-3xl px-4 py-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} {APP_NAME}</span>
          <div className="flex gap-4">
            <Link to="/terms" onClick={() => window.scrollTo(0, 0)} className="hover:text-foreground transition-colors">Terms of Service</Link>
            <Link to="/" onClick={() => window.scrollTo(0, 0)} className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
