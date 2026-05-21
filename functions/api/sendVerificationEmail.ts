import type { Env } from '../_lib/auth';
import { sha256Hex, generateShareToken, makeId } from '../_lib/share';

/**
 * Shared helper — creates a verification token and sends the email.
 * Used by signup.ts and resendVerification.ts.
 */
export async function sendVerificationEmail(
  env: Env,
  userId: string,
  userEmail: string
): Promise<void> {
  // Invalidate any existing unused tokens for this user
  await env.DB
    .prepare(`UPDATE email_verifications SET used_at = ? WHERE user_id = ? AND used_at IS NULL`)
    .bind(new Date().toISOString(), userId)
    .run();

  // Create new token — expires in 24 hours
  const token = generateShareToken(32);
  const tokenHash = await sha256Hex(token);
  const id = makeId();
  const expiresAt = new Date();
  expiresAt.setUTCHours(expiresAt.getUTCHours() + 24);

  await env.DB
    .prepare(`
      INSERT INTO email_verifications (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, userId, tokenHash, expiresAt.toISOString())
    .run();

  const verifyUrl = `https://cloudtrips.uk/verify-email.html?token=${encodeURIComponent(token)}`;

  const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': env.BREVO_API_KEY
    },
    body: JSON.stringify({
      sender: { name: 'CloudTrips', email: env.BREVO_SENDER_EMAIL },
      to: [{ email: userEmail }],
      subject: 'Verify your CloudTrips email',
      htmlContent: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#0f172a;">Verify your email</h1>
          <p style="color:#475569;margin-bottom:24px;">
            Click the button below to verify your email address and activate your CloudTrips account.
            This link expires in <strong>24 hours</strong>.
          </p>
          <a href="${verifyUrl}"
            style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:24px;">
            Verify email
          </a>
          <p style="color:#94a3b8;font-size:13px;">
            If you didn't create a CloudTrips account, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="color:#cbd5e1;font-size:12px;">CloudTrips · cloudtrips.uk</p>
        </div>
      `
    })
  });

  if (!emailRes.ok) {
    console.error('Brevo error (verification email):', await emailRes.text());
    throw new Error('Failed to send verification email.');
  }
}
