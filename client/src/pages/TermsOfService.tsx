import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { APP_NAME } from '@/lib/constants';

// --- Update these before publishing ------------------------------------------
// EFFECTIVE_DATE: bump whenever the terms content changes.
// CONTACT_EMAIL: must be a monitored inbox.
// OWNER: the ACRA-registered business name, or your full legal name if
//   operating as an individual/sole proprietor.
const EFFECTIVE_DATE = '18 July 2026';
const CONTACT_EMAIL = 'paypr.live@gmail.com';
const OWNER = 'Anna Maria Blukacz';
// -----------------------------------------------------------------------------

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
        <p className="text-sm text-muted-foreground mb-10">Last updated: {EFFECTIVE_DATE}</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service (&ldquo;Terms&rdquo;) govern your use of {APP_NAME}, operated by{' '}
              {OWNER} (&ldquo;{APP_NAME}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), based in Singapore.
              Please read them carefully. They should be read together with our{' '}
              <Link to="/privacy" className="underline hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using {APP_NAME}, you agree to be bound by these Terms. If you do not
              agree to them, please do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              You must be at least 18 years old to create an account and use {APP_NAME}. By using the
              service, you represent that you meet this requirement and that the information you provide
              is accurate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              {APP_NAME} is a personal organisation tool that helps you record and track your recurring
              subscriptions, view spending summaries, and receive renewal reminders. It can also extract
              subscription details from receipts or invoices you upload. {APP_NAME} is an informational
              tool only: it does <strong>not</strong> process payments, connect to your bank or financial
              accounts, move money, or provide financial, legal, or tax advice. The service is provided
              on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis and may be changed, suspended,
              or discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Your Account</h2>
            <p className="text-muted-foreground leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activity that occurs under your account. You agree to provide accurate information and
              to notify us promptly at {CONTACT_EMAIL} of any unauthorised use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Your Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of the subscription information and documents (such as receipts and
              invoices) you submit to {APP_NAME} (&ldquo;Your Content&rdquo;). You grant us a limited
              licence to store and process Your Content solely to provide the service to you, including
              sending relevant content to our service providers for AI-assisted extraction as described in
              our Privacy Policy. You are responsible for ensuring you have the right to upload Your
              Content and that it does not infringe any third-party rights or any law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to use {APP_NAME} only for lawful purposes and in accordance with these Terms. You
              must not misuse the service &mdash; including by attempting to gain unauthorised access,
              disrupting or overloading the service, reverse-engineering it, uploading malicious code, or
              using it to store or transmit unlawful content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Reminders and AI Extraction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Renewal reminders and AI-assisted document extraction are provided on a best-effort basis and
              may be delayed, incomplete, or inaccurate. They are a convenience only and are not a
              substitute for your own records. You are solely responsible for managing your subscriptions,
              cancellations, and payments, and we are not liable for any missed renewal, unwanted charge, or
              decision made in reliance on the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All content, features, and functionality of {APP_NAME} (excluding Your Content) are owned by
              us or our licensors and are protected by applicable intellectual property laws. You may not
              copy, modify, distribute, or create derivative works from any part of the service without our
              prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, {APP_NAME} is provided without warranties of any kind,
              whether express or implied, including any implied warranties of merchantability, fitness for a
              particular purpose, or non-infringement. We do not warrant that the service will be
              uninterrupted, error-free, or secure, or that any information it provides is accurate or
              complete.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the fullest extent permitted by law, {APP_NAME} and its operator shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of data,
              savings, or profits, arising from or related to your use of (or inability to use) the service.
              Nothing in these Terms excludes or limits liability that cannot be excluded or limited under
              applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may delete your account at any time from your settings. We may suspend or terminate your
              access if you breach these Terms or if we discontinue the service. On termination, your right
              to use {APP_NAME} ceases and we will handle your data as described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of Singapore, and you agree to submit to the exclusive
              jurisdiction of the courts of Singapore in respect of any dispute arising out of or in
              connection with them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to These Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms from time to time. We will update the &ldquo;Last updated&rdquo; date
              above and, for significant changes, notify you by email or through the service. Your continued
              use of {APP_NAME} after changes take effect constitutes your acceptance of the revised Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-foreground transition-colors">
                {CONTACT_EMAIL}
              </a>
              .
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
