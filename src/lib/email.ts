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
  text?: string;
  replyTo?: string;
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
        // A plain-text alternative markedly improves deliverability and helps
        // Gmail treat the message as transactional (Primary tab) not promotional.
        ...(input.text ? { text: input.text } : {}),
        // A real Reply-To (the inviter) is a strong "not bulk marketing" signal.
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
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
  // Kept deliberately plain and text-like (no big marketing button, no banner
  // images, left-aligned) so Gmail treats it as a transactional message and
  // sorts it into Primary rather than Promotions.
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;color:#222;line-height:1.6">
  <p>Hi,</p>
  <p>You've been invited${by} to join <strong>${escapeHtml(input.appName)}</strong> as ${escapeHtml(input.role)}.</p>
  <p>Set up your account here:<br><a href="${input.link}" style="color:#2563eb">${input.link}</a></p>
  <p>You can sign in with Google or create a password. If you weren't expecting this, you can ignore this email.</p>
  <p>— ${escapeHtml(input.appName)}</p>
</div>`;
}

export function inviteEmailText(input: {
  appName: string;
  role: string;
  link: string;
  inviterName?: string | null;
}): string {
  const by = input.inviterName ? ` by ${input.inviterName}` : "";
  return [
    `Hi,`,
    ``,
    `You've been invited${by} to join ${input.appName} as ${input.role}.`,
    ``,
    `Set up your account here:`,
    input.link,
    ``,
    `You can sign in with Google or create a password. If you weren't expecting this, you can ignore this email.`,
    ``,
    `— ${input.appName}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
