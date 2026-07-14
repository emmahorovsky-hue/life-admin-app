import { writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { buildEmailHtml } from '../src/services/emailService';

// Use the local Vite dev server so images resolve without needing a deployed CLIENT_URL
process.env.CLIENT_URL = 'http://localhost:3000';

const emails = [
  {
    name: 'welcome',
    html: buildEmailHtml({
      heading: 'Welcome',
      bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Click the button below to verify your email. The link expires in 24 hours.</p>`,
      ctaText: 'Verify email',
      ctaUrl: 'http://localhost:3001/api/auth/verify-email?token=preview',
      footerNote: "If you didn't sign up for Paypr, you can safely ignore this email.",
      illustrationUrl: 'http://localhost:3000/email-welcome.png',
    }),
  },
  {
    name: 'deletion-warning',
    html: buildEmailHtml({
      heading: 'Verify your email to keep your account',
      bodyHtml: `
        <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5;">Your Paypr account hasn't been verified yet. To keep it, please verify your email within <strong>48 hours</strong> — after that the account and its data will be permanently deleted.</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Log in and use the &ldquo;Resend&rdquo; button on the verification banner to get a fresh link:</p>
      `,
      ctaText: 'Log in to verify',
      ctaUrl: 'http://localhost:3000/login',
      footerNote: "If you didn't sign up for Paypr, no action is needed — the account will be removed automatically.",
    }),
  },
  {
    name: 'account-deleted',
    html: buildEmailHtml({
      heading: 'Your account has been deleted',
      bodyHtml: `
        <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5;">Your Paypr account and all of its data — subscriptions, reminders, and settings — have been permanently deleted, as you requested.</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Thanks for giving Paypr a try. If you change your mind, you're always welcome to create a new account.</p>
      `,
      ctaText: 'Back to Paypr',
      ctaUrl: 'http://localhost:3000',
      footerNote: "If you didn't request this deletion, please contact us immediately by replying to this email.",
    }),
  },
  {
    name: 'password-reset',
    html: buildEmailHtml({
      heading: 'Reset your password',
      bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your Paypr account. Click the button below to choose a new password. The link expires in 1 hour.</p>`,
      ctaText: 'Reset password',
      ctaUrl: 'http://localhost:3000/reset-password?token=preview',
      footerNote: "If you didn't request a password reset, you can safely ignore this email. Your password will not change.",
      illustrationUrl: 'http://localhost:3000/email-password-reset.png',
    }),
  },
];

for (const { name, html } of emails) {
  const path = `/tmp/paypr-email-${name}.html`;
  writeFileSync(path, html);
  console.log(`Written: ${path}`);
  execSync(`open ${path}`);
}
