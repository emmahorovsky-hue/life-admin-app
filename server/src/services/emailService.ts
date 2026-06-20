import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'noreply@paypr.live';

function buildEmailHtml({ heading, bodyHtml, ctaText, ctaUrl, footerNote }: {
  heading: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
}): string {
  return `
    <html>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 32px 16px; background: #FAFAF8; font-family: 'Archivo', system-ui, sans-serif; color: #161616;">
        <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #CBC7C1; border-radius: 2px; overflow: hidden;">
          <div style="padding: 20px 32px; border-bottom: 1px dashed #CBC7C1;">
            <span style="font-size: 20px; font-weight: 600; color: #161616;">Pay<span style="color: #E53D00;">pr</span></span>
          </div>
          <div style="padding: 32px 32px 24px;">
            <h1 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #161616;">${heading}</h1>
            ${bodyHtml}
            <a href="${ctaUrl}" style="display: inline-block; background: #161616; color: #FAFAF8; padding: 12px 24px; text-decoration: none; border-radius: 2px; font-weight: 600; font-size: 14px; margin-top: 8px;">${ctaText}</a>
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
    console.log('[Email Service] Resend not configured. Would send verification email to:', to);
    console.log('[Email Service] Verification URL:', verifyUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Verify your email for Paypr';
  const html = buildEmailHtml({
    heading: 'Welcome',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Click the button below to verify your email. The link expires in ${expiresInHours} hours.</p>`,
    ctaText: 'Verify email',
    ctaUrl: verifyUrl,
    footerNote: "If you didn't sign up for Paypr, you can safely ignore this email.",
  });
  const text = `Welcome! Click this link to verify your email: ${verifyUrl}\nLink expires in ${expiresInHours} hours.\nIf you didn't sign up, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendDeletionWarningEmail({ to, deleteInHours, loginUrl }: { to: string; deleteInHours: number; loginUrl: string }) {
  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send deletion-warning email to:', to);
    console.log('[Email Service] Login URL:', loginUrl);
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

export async function sendPasswordResetEmail({ to, resetUrl, expiresInHours }: { to: string; resetUrl: string; expiresInHours: number }) {
  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send password reset email to:', to);
    console.log('[Email Service] Reset URL:', resetUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Reset your Paypr password';
  const html = buildEmailHtml({
    heading: 'Reset your password',
    bodyHtml: `<p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your Paypr account. Click the button below to choose a new password. The link expires in ${expiresInHours} hour.</p>`,
    ctaText: 'Reset password',
    ctaUrl: resetUrl,
    footerNote: "If you didn't request a password reset, you can safely ignore this email. Your password will not change.",
  });
  const text = `Reset your Paypr password by clicking this link: ${resetUrl}\nThe link expires in ${expiresInHours} hour.\nIf you didn't request this, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}