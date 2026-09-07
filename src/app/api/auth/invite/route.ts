import { NextResponse } from "next/server";
import { getInviteByToken } from "@/lib/db/invites";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";

export const runtime = "nodejs";

// Public: the login page uses this to show who an invite is for.
export async function GET(req: Request) {
  if (!authConfigured() || !dbConfigured()) {
    return NextResponse.json({ valid: false });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false });
  const invite = await getInviteByToken(token).catch(() => null);
  if (!invite || invite.acceptedAt) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, email: invite.email, role: invite.role });
}
