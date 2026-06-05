import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? 'noreply@paypr.live';

export async function sendVerificationEmail({ to, verifyUrl, expiresInHours }: { to: string; verifyUrl: string; expiresInHours: number }) {
  // If Resend is not configured, log instead of sending
  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send verification email to:', to);
    console.log('[Email Service] Verification URL:', verifyUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Verify your email for Paypr';
  const html = `
    <html>
      <body style="font-family: system-ui, sans-serif; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto;">
          <h1>Welcome 👋</h1>
          <p>Click the button below to verify your email. The link expires in ${expiresInHours} hours.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify email</a>
          <p style="font-size: 12px; color: #888;">Or paste this URL into your browser:<br>${verifyUrl}</p>
          <p style="font-size: 12px; color: #888; margin-top: 24px;">If you didn't sign up for Paypr, you can safely ignore this email.</p>
          <p>— Paypr</p>
        </div>
      </body>
    </html>
  `;
  const text = `Welcome! Click this link to verify your email: ${verifyUrl}\nLink expires in ${expiresInHours} hours.\nIf you didn't sign up, ignore this email.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}

export async function sendDeletionWarningEmail({ to, deleteInHours, loginUrl }: { to: string; deleteInHours: number; loginUrl: string }) {
  // If Resend is not configured, log instead of sending
  if (!resend) {
    console.log('[Email Service] Resend not configured. Would send deletion-warning email to:', to);
    console.log('[Email Service] Login URL:', loginUrl);
    return { id: 'mock-email-id' };
  }
  const subject = 'Action needed: verify your email or your account will be deleted';
  const html = `
    <html>
      <body style="font-family: system-ui, sans-serif; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto;">
          <h1>Verify your email to keep your account</h1>
          <p>Your Paypr account hasn't been verified yet. To keep it, please verify your email within <strong>${deleteInHours} hours</strong> — after that the account and its data will be permanently deleted.</p>
          <p>Log in and use the "Resend" button on the verification banner to get a fresh link:</p>
          <a href="${loginUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Log in to verify</a>
          <p style="font-size: 12px; color: #888;">Or paste this URL into your browser:<br>${loginUrl}</p>
          <p style="font-size: 12px; color: #888; margin-top: 24px;">If you didn't sign up for Paypr, no action is needed — the account will be removed automatically.</p>
          <p>— Paypr</p>
        </div>
      </body>
    </html>
  `;
  const text = `Your Paypr account hasn't been verified. Verify your email within ${deleteInHours} hours or the account and its data will be permanently deleted.\nLog in to get a fresh verification link: ${loginUrl}\nIf you didn't sign up, no action is needed.`;

  const res = await resend!.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}