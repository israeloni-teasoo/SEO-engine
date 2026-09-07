import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { createInvite, listInvites } from "@/lib/db/invites";
import { getUserByEmail } from "@/lib/db/users";
import { logActivity } from "@/lib/db/activity";
import { sendEmail, inviteEmailHtml, emailConfigured } from "@/lib/email";
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

    const invite = await createInvite({ email, role, invitedBy: admin.sub });
    const origin = new URL(req.url).origin;
    const link = `${origin}/login?invite=${invite.token}`;

    const emailResult = await sendEmail({
      to: email,
      subject: "You're invited to SEO Engine",
      html: inviteEmailHtml({ appName: "SEO Engine", role, link, inviterName: admin.name }),
    });
    await logActivity({ userId: admin.sub, action: "invited", detail: `${email} as ${role}` });

    return NextResponse.json({
      ok: true,
      invite: { id: invite.id, email, role },
      link,
      emailed: emailResult.sent,
      emailError: emailResult.sent ? undefined : emailResult.error,
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
