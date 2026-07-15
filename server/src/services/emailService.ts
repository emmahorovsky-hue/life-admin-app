import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'noreply@paypr.live';

const CLIENT_URL = process.env.CLIENT_URL ?? 'https://paypr.live';

// The URLs in these emails carry raw single-use tokens, so they must never
// reach production logs — only echo them to stdout in local dev (LIF-148).
function logEmailNotSent(description: string, to: string, urlLabel: string, url: string): void {
  if (process.env.NODE_ENV === 'production') {
    console.log(`[Email Service] ${description} skipped: RESEND_API_KEY unset`);
    return;
  }
  console.log(`[Email Service] Resend not configured. Would send ${description} to:`, to);
  console.log(`[Email Service] ${urlLabel}:`, url);
}

export function buildEmailHtml({ heading, bodyHtml, ctaText, ctaUrl, footerNote, illustrationUrl }: {
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
  illustrationUrl?: string;
}): string {
  const illustration = illustrationUrl
    ? `<img src="${illustrationUrl}" alt="" width="560" style="display: block; width: 100%; height: auto; border-bottom: 1px dashed #CBC7C1;" />`
    : '';
  return `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 32px 16px; background: #FBFBF9; font-family: 'Archivo', system-ui, sans-serif; color: #161616;">
        <div style="max-width: 560px; margin: 0 auto; background: #FBFBF9; border: 1px solid #CBC7C1; border-radius: 2px; overflow: hidden;">
          <div style="padding: 20px 32px; border-bottom: 1px dashed #CBC7C1;">
            <img src="${CLIENT_URL}/paypr-wordmark.png" alt="Paypr" width="89" height="28" style="display: block; height: 28px; width: auto; border: 0;" />
          </div>
          ${illustration}
          <div style="padding: 32px 32px 24px;">
            <h1 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #161616;">${heading}</h1>
            ${bodyHtml}
            <a href="${ctaUrl}" style="display: inline-block; background: #161616; color: #FBFBF9; padding: 12px 24px; text-decoration: none; border-radius: 2px; font-weight: 600; font-size: 14px; margin-top: 8px;">${ctaText}</a>
            <p style="margin: 16px 0 0; font-size: 12px; color: #7F7B73;">Or paste this URL into your browser:<br><a href="${ctaUrl}" style="color: #7F7B73;">${ctaUrl}</a></p>
          </div>
          <div style="border-top: 1px dashed #CBC7C1; margin: 0 32px;"></div>
          <div style="padding: 16px 32px 24px;">
            <p style="margin: 0; font-size: 12px; color: #7F7B73;">${footerNote}</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendVerificationEmail({ to, verifyUrl, expiresInHours }: { to: string; verifyUrl: string; expiresInHours: number }) {
  if (!resend) {
    logEmailNotSent('verification email', to, 'Verification URL', verifyUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Verify your email for Paypr';
  const html = buildEmailHtml({
    heading: 'Welcome',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Click the button below to verify your email. The link expires in ${expiresInHours} hours.</p>`,
    ctaText: 'Verify email',
    ctaUrl: verifyUrl,
    footerNote: "If you didn't sign up for Paypr, you can safely ignore this email.",
    illustrationUrl: `${CLIENT_URL}/email-welcome.png`,
  });
  const text = `Welcome! Click this link to verify your email: ${verifyUrl}\nLink expires in ${expiresInHours} hours.\nIf you didn't sign up, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendDeletionWarningEmail({ to, deleteInHours, loginUrl }: { to: string; deleteInHours: number; loginUrl: string }) {
  if (!resend) {
    logEmailNotSent('deletion-warning email', to, 'Login URL', loginUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Action needed: verify your email or your account will be deleted';
  const html = buildEmailHtml({
    heading: 'Verify your email to keep your account',
    bodyHtml: `
      <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5;">Your Paypr account hasn't been verified yet. To keep it, please verify your email within <strong>${deleteInHours} hours</strong> — after that the account and its data will be permanently deleted.</p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Log in and use the &ldquo;Resend&rdquo; button on the verification banner to get a fresh link:</p>
    `,
    ctaText: 'Log in to verify',
    ctaUrl: loginUrl,
    footerNote: "If you didn't sign up for Paypr, no action is needed — the account will be removed automatically.",
  });
  const text = `Your Paypr account hasn't been verified. Verify your email within ${deleteInHours} hours or the account and its data will be permanently deleted.\nLog in to get a fresh verification link: ${loginUrl}\nIf you didn't sign up, no action is needed.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendAccountDeletedEmail({ to }: { to: string }) {
  if (!resend) {
    logEmailNotSent('account-deleted email', to, 'Site URL', CLIENT_URL);
    return { id: 'mock-email-id' };
  }
  const subject = 'Your Paypr account has been deleted';
  const html = buildEmailHtml({
    heading: 'Your account has been deleted',
    bodyHtml: `
      <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5;">Your Paypr account and all of its data — subscriptions, reminders, and settings — have been permanently deleted, as you requested.</p>
      <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Thanks for giving Paypr a try. If you change your mind, you're always welcome to create a new account.</p>
    `,
    ctaText: 'Back to Paypr',
    ctaUrl: CLIENT_URL,
    footerNote: "If you didn't request this deletion, please contact us immediately by replying to this email.",
  });
  const text = `Your Paypr account and all of its data have been permanently deleted, as you requested.\nThanks for giving Paypr a try — you're always welcome to create a new account: ${CLIENT_URL}\nIf you didn't request this deletion, reply to this email immediately.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendEmailChangeVerificationEmail({ to, verifyUrl, expiresInHours }: { to: string; verifyUrl: string; expiresInHours: number }) {
  if (!resend) {
    logEmailNotSent('email-change verification email', to, 'Verification URL', verifyUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Confirm your new email address for Paypr';
  const html = buildEmailHtml({
    heading: 'Confirm your new email',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Click the button below to confirm this address as your new Paypr login email. The link expires in ${expiresInHours} hours.</p>`,
    ctaText: 'Confirm new email',
    ctaUrl: verifyUrl,
    footerNote: "If you didn't request this change, you can safely ignore this email. Your current email address will not change.",
  });
  const text = `Confirm your new Paypr email by clicking this link: ${verifyUrl}\nThe link expires in ${expiresInHours} hours.\nIf you didn't request this, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendEmailChangedNoticeEmail({ to, newEmail }: { to: string; newEmail: string }) {
  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send email-changed notice to:', to);
    console.log('[Email Service] New email:', newEmail);
    return { id: 'mock-email-id' };
  }
  const subject = 'Your Paypr email address was changed';
  const html = buildEmailHtml({
    heading: 'Your email address was changed',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">The login email for your Paypr account was just changed to <strong>${newEmail}</strong>. If this was you, no action is needed.</p>`,
    ctaText: 'Go to Paypr',
    ctaUrl: `${CLIENT_URL}/login`,
    footerNote: "If you didn't make this change, your account may be compromised — contact support immediately.",
  });
  const text = `The login email for your Paypr account was changed to ${newEmail}.\nIf this wasn't you, your account may be compromised — contact support immediately.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

// User-controlled values (subscription name, currency, billing cycle) are the
// only user content interpolated into any email HTML — escape them so a
// subscription named e.g. "<img src=…>" can't inject markup into the message.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type DigestItem = {
  name: string;
  cost: number;
  currency: string;
  billingCycle: string;
  renewalDate: Date;
  daysUntil: number;
};

function daysUntilLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

// One email per user per run covering every subscription due for a reminder,
// instead of a separate email per subscription.
export async function sendRenewalReminderDigest({ to, items }: { to: string; items: DigestItem[] }) {
  const manageUrl = `${CLIENT_URL}/subscriptions`;
  const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const formatCost = (item: DigestItem) => `${item.currency} ${item.cost.toFixed(2)}`;

  const subject = items.length === 1
    ? `${items[0].name} renews ${daysUntilLabel(items[0].daysUntil)} (${formatCost(items[0])})`
    : `${items.length} subscriptions renew soon`;

  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send renewal reminder digest to:', to);
    console.log('[Email Service] Subscriptions:', items.map((i) => `${i.name} (${formatDate(i.renewalDate)})`).join(', '));
    return { id: 'mock-email-id' };
  }

  const rows = items
    .map((item) => `
        <tr>
          <td style="padding: 8px 16px 8px 0; border-bottom: 1px dashed #CBC7C1;"><strong>${escapeHtml(item.name)}</strong><br><span style="color: #7F7B73; font-size: 12px;">${escapeHtml(item.billingCycle)}</span></td>
          <td style="padding: 8px 16px 8px 0; border-bottom: 1px dashed #CBC7C1; white-space: nowrap;">${escapeHtml(formatCost(item))}</td>
          <td style="padding: 8px 0; border-bottom: 1px dashed #CBC7C1; white-space: nowrap;">${formatDate(item.renewalDate)}<br><span style="color: #7F7B73; font-size: 12px;">renews ${daysUntilLabel(item.daysUntil)}</span></td>
        </tr>`)
    .join('');

  const html = buildEmailHtml({
    heading: items.length === 1 ? `Your ${escapeHtml(items[0].name)} subscription renews soon` : `${items.length} of your subscriptions renew soon`,
    bodyHtml: `
      <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.5;">This is a heads-up about upcoming charges, so you have time to cancel anything you no longer need.</p>
      <table style="margin: 0 0 16px; font-size: 14px; color: #161616; border-collapse: collapse; width: 100%;">${rows}
      </table>
    `,
    ctaText: 'Manage subscriptions',
    ctaUrl: manageUrl,
    footerNote: `You're getting these because renewal reminders are on. You can turn them off or mute individual subscriptions in your <a href="${CLIENT_URL}/profile" style="color: #7F7B73;">profile settings</a>.`,
  });
  const text = [
    'Upcoming subscription renewals:',
    ...items.map((item) => `- ${item.name}: ${formatCost(item)} (${item.billingCycle}), renews ${daysUntilLabel(item.daysUntil)} on ${formatDate(item.renewalDate)}`),
    `Manage your subscriptions: ${manageUrl}`,
    `Turn reminders off in your profile settings: ${CLIENT_URL}/profile`,
  ].join('\n');

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendPasswordResetEmail({ to, resetUrl, expiresInHours }: { to: string; resetUrl: string; expiresInHours: number }) {
  if (!resend) {
    logEmailNotSent('password reset email', to, 'Reset URL', resetUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Reset your Paypr password';
  const html = buildEmailHtml({
    heading: 'Reset your password',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your Paypr account. Click the button below to choose a new password. The link expires in ${expiresInHours} hour.</p>`,
    ctaText: 'Reset password',
    ctaUrl: resetUrl,
    footerNote: "If you didn't request a password reset, you can safely ignore this email. Your password will not change.",
    illustrationUrl: `${CLIENT_URL}/email-password-reset.png`,
  });
  const text = `Reset your Paypr password by clicking this link: ${resetUrl}\nThe link expires in ${expiresInHours} hour.\nIf you didn't request this, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}