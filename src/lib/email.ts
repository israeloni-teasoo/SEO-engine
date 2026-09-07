// Minimal transactional email via Resend (https://resend.com — free tier, HTTP
// API, works on Vercel). If RESEND_API_KEY isn't set, sending is skipped and the
// caller shows the invite link so the admin can share it manually.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface SendResult {
  sent: boolean;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!emailConfigured()) return { sent: false, error: "Email is not configured." };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) return { sent: false, error: `Email provider error (${res.status}): ${await res.text()}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: (e as Error).message };
  }
}

export function inviteEmailHtml(input: {
  appName: string;
  role: string;
  link: string;
  inviterName?: string | null;
}): string {
  const by = input.inviterName ? ` by ${escapeHtml(input.inviterName)}` : "";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h2 style="margin:0 0 8px">You've been invited to ${escapeHtml(input.appName)}</h2>
    <p style="color:#444;font-size:15px;line-height:1.6">
      You were invited${by} to join as <strong>${escapeHtml(input.role)}</strong>.
      Click below to set up your account. You can sign in with Google or create a password.
    </p>
    <p style="margin:22px 0">
      <a href="${input.link}" style="background:#2563eb;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">
        Accept invitation
      </a>
    </p>
    <p style="color:#888;font-size:12px">If the button doesn't work, copy this link:<br>${input.link}</p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
