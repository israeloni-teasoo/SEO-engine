import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { createInvite, listInvites, getPendingInvite, setInviteRole } from "@/lib/db/invites";
import { getUserByEmail } from "@/lib/db/users";
import { logActivity } from "@/lib/db/activity";
import { sendEmail, inviteEmailHtml, inviteEmailText, emailConfigured } from "@/lib/email";
import type { Role } from "@/lib/auth/session";

export const runtime = "nodejs";

const ROLES: Role[] = ["admin", "editor", "author"];

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    const invites = await listInvites();
    return NextResponse.json({
      invites: invites.map((i) => ({
        id: i.id, email: i.email, role: i.role,
        accepted: Boolean(i.acceptedAt), createdAt: i.createdAt,
      })),
      emailConfigured: emailConfigured(),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(req, "admin");
    const body = (await req.json()) as { email?: string; role?: Role };
    const email = (body.email ?? "").trim().toLowerCase();
    const role = ROLES.includes(body.role as Role) ? (body.role as Role) : "author";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (await getUserByEmail(email)) {
      return NextResponse.json({ error: "That person already has an account." }, { status: 409 });
    }

    // Reuse an existing pending invite instead of creating a duplicate row.
    // If it was created seconds ago, treat this as an accidental double-submit
    // and don't send a second email.
    const existing = await getPendingInvite(email);
    const DUPLICATE_WINDOW_MS = 20_000;
    const isDuplicateClick =
      existing != null && Date.now() - new Date(existing.createdAt).getTime() < DUPLICATE_WINDOW_MS;

    let invite = existing;
    if (!invite) {
      invite = await createInvite({ email, role, invitedBy: admin.sub });
    } else if (invite.role !== role && !isDuplicateClick) {
      await setInviteRole(invite.id, role);
      invite = { ...invite, role };
    }

    const origin = new URL(req.url).origin;
    const link = `${origin}/login?invite=${invite.token}`;

    if (isDuplicateClick) {
      // Same person invited a moment ago — no second email, no duplicate log.
      return NextResponse.json({
        ok: true,
        invite: { id: invite.id, email, role: invite.role },
        link,
        emailed: false,
        emailConfigured: emailConfigured(),
        duplicate: true,
      });
    }

    const emailResult = await sendEmail({
      to: email,
      subject: `${admin.name || "You"} invited you to SEO Engine`,
      html: inviteEmailHtml({ appName: "SEO Engine", role: invite.role, link, inviterName: admin.name }),
      text: inviteEmailText({ appName: "SEO Engine", role: invite.role, link, inviterName: admin.name }),
      replyTo: admin.email || undefined,
    });
    await logActivity({ userId: admin.sub, action: "invited", detail: `${email} as ${invite.role}${existing ? " (resend)" : ""}` });

    return NextResponse.json({
      ok: true,
      invite: { id: invite.id, email, role: invite.role },
      link,
      emailed: emailResult.sent,
      emailConfigured: emailConfigured(),
      emailError: emailResult.sent ? undefined : emailResult.error,
      reused: Boolean(existing),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
