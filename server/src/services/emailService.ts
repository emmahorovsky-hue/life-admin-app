import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@lifeadmin.dev';

export async function sendVerificationEmail({ to, verifyUrl, expiresInHours }: { to: string; verifyUrl: string; expiresInHours: number }) {
  const subject = 'Verify your email for Life Admin App';
  const html = `
    <html>
      <body style="font-family: system-ui, sans-serif; padding: 24px;">
        <div style="max-width: 560px; margin: 0 auto;">
          <h1>Welcome 👋</h1>
          <p>Click the button below to verify your email. The link expires in ${expiresInHours} hours.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Verify email</a>
          <p style="font-size: 12px; color: #888;">Or paste this URL into your browser:<br>${verifyUrl}</p>
          <p style="font-size: 12px; color: #888; margin-top: 24px;">If you didn't sign up for Life Admin App, you can safely ignore this email.</p>
          <p>— Life Admin App</p>
        </div>
      </body>
    </html>
  `;
  const text = `Welcome! Click this link to verify your email: ${verifyUrl}\nLink expires in ${expiresInHours} hours.\nIf you didn't sign up, ignore this email.`;

  const res = await resend.emails.send({ from: FROM, to, subject, html, text });
  if (res.error) throw new Error(`${res.error.name}: ${res.error.message}`);
  return res.data!;
}