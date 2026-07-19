import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { APP_NAME } from '@/lib/constants';

// --- Update these before publishing ------------------------------------------
// EFFECTIVE_DATE: bump whenever the policy content changes.
// DPO_EMAIL: must be a monitored inbox (PDPA requires a reachable DPO contact).
// LEGAL_ENTITY: the ACRA-registered business name, or your full legal name if
//   operating as an individual/sole proprietor. This is the data controller.
const EFFECTIVE_DATE = '18 July 2026';
const DPO_EMAIL = 'paypr.live@gmail.com';
const LEGAL_ENTITY = 'Anna Maria Blukacz';
// -----------------------------------------------------------------------------

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
        <p className="text-sm text-muted-foreground mb-10">Last updated: {EFFECTIVE_DATE}</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy explains how {APP_NAME} (&ldquo;{APP_NAME}&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;) collects, uses, discloses, and protects your personal data. {APP_NAME}{' '}
              is operated by {LEGAL_ENTITY}, based in Singapore. We handle personal data in accordance
              with Singapore&rsquo;s Personal Data Protection Act 2012 (the &ldquo;PDPA&rdquo;). By
              creating an account or using {APP_NAME}, you consent to the practices described here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We collect the following categories of personal data:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
              <li>
                <strong>Account information</strong> &mdash; your email address and password (stored
                only as a secure one-way hash), and an optional profile avatar image you choose to
                upload.
              </li>
              <li>
                <strong>Subscription data you enter</strong> &mdash; the names, costs, currencies,
                billing cycles, renewal dates, categories, and notes for the subscriptions you track.
              </li>
              <li>
                <strong>Documents you upload</strong> &mdash; receipts, invoices, or similar documents
                you submit so that {APP_NAME} can extract subscription details from them. See
                Section 5 for how this content is processed.
              </li>
              <li>
                <strong>Device and technical data</strong> &mdash; if you enable notifications, a
                device push token; and limited technical information (such as IP address, browser or
                device type, and error diagnostics) generated automatically when you use the service.
              </li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do <strong>not</strong> collect payment card numbers, bank account details, or bank
              login credentials, and {APP_NAME} does not connect to your financial institutions or
              move money on your behalf.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use your personal data to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
              <li>create and maintain your account and authenticate your sign-in;</li>
              <li>provide the core service &mdash; tracking your subscriptions and showing spending summaries;</li>
              <li>extract subscription details from documents you choose to upload;</li>
              <li>send you renewal reminders, service notifications, and account-related emails (such as email verification and password resets);</li>
              <li>keep the service secure, diagnose errors, and improve {APP_NAME}; and</li>
              <li>respond to your enquiries and comply with legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Consent and Withdrawal</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect, use, and disclose your personal data with your consent, for the purposes set
              out in this policy or as otherwise permitted under the PDPA. You may withdraw your consent
              at any time by contacting us at {DPO_EMAIL}, or by deleting your account. Withdrawing
              consent may mean we can no longer provide some or all of the service to you. Withdrawal
              does not affect the lawfulness of processing carried out before withdrawal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. How We Share Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do <strong>not</strong> sell, rent, or trade your personal data. We share it only with
              service providers (data intermediaries) who process it on our behalf to operate {APP_NAME},
              and only to the extent needed to provide the service, or where required by law. Our key
              service providers are listed in Section 5.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Service Providers</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We rely on the following third-party providers to run {APP_NAME}. Each processes personal
              data only as needed to deliver its service:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground leading-relaxed">
              <li><strong>Railway</strong> &mdash; backend application and database hosting.</li>
              <li><strong>Vercel</strong> &mdash; hosting of the web application.</li>
              <li><strong>Resend</strong> &mdash; delivery of transactional and reminder emails.</li>
              <li><strong>Expo</strong> &mdash; delivery of push notifications to your device.</li>
              <li><strong>Sentry</strong> &mdash; error monitoring and diagnostics.</li>
              <li>
                <strong>Anthropic</strong> &mdash; when you upload a receipt or invoice for extraction,
                its contents are sent to Anthropic&rsquo;s AI service to identify subscription details.
                This content is used only to perform the extraction and is not used to train AI models.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. International Transfers of Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              {APP_NAME} is operated from Singapore, but several of the service providers in Section 5
              store or process data on servers located outside Singapore (including in the United States
              and other jurisdictions). Where we transfer your personal data overseas, we take reasonable
              steps to ensure it receives a standard of protection comparable to that under the PDPA, for
              example through the contractual terms offered by these providers. By using {APP_NAME}, you
              consent to these transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement reasonable technical and organisational measures to protect your personal
              data against unauthorised access, collection, use, disclosure, loss, or alteration. These
              include encrypted transport (HTTPS), one-way hashing of passwords, and access controls.
              No method of transmission or storage is completely secure, however, and we cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data only for as long as your account is active or as needed to
              provide the service. If you delete your account, we will delete or anonymise your personal
              data within 30 days, except where we are required to retain certain information to comply
              with legal, accounting, or reporting obligations. Unverified accounts are automatically
              deleted after a short grace period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Under the PDPA, you have the right to request access to the personal data we hold about
              you and information about how it has been used, and to request correction of inaccurate or
              incomplete data. You can update your account details directly in your settings, or contact
              our Data Protection Officer at {DPO_EMAIL} to make an access or correction request, or to
              request deletion of your account and associated data. We will respond to verified requests
              within the timeframes required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use a strictly necessary cookie to keep you signed in. We do not use cookies for
              advertising, profiling, or third-party tracking. You can control or delete cookies through
              your browser settings, but disabling the sign-in cookie will prevent you from using your
              account on the web.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Children&rsquo;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              {APP_NAME} is not directed to children and is not intended for use by anyone under 18. We
              do not knowingly collect personal data from children. If you believe a child has provided
              us with personal data, please contact us so we can delete it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Data Breach Notification</h2>
            <p className="text-muted-foreground leading-relaxed">
              In the event of a data breach that is likely to result in significant harm to affected
              individuals, or that meets the notification thresholds under the PDPA, we will notify the
              Personal Data Protection Commission and affected individuals as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will update the &ldquo;Last
              updated&rdquo; date above and, for significant changes, notify you by email. Your continued
              use of {APP_NAME} after changes take effect constitutes your acceptance of the revised
              policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy, or wish to exercise your rights or make
              a complaint, please contact our Data Protection Officer at{' '}
              <a href={`mailto:${DPO_EMAIL}`} className="underline hover:text-foreground transition-colors">
                {DPO_EMAIL}
              </a>
              . If you are not satisfied with our response, you may lodge a complaint with the Personal
              Data Protection Commission of Singapore (PDPC).
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
