import { NextResponse } from "next/server";
import { getSession, authConfigured } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/users";
import { dbConfigured } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Single-user mode: no auth configured -> report an implicit admin.
  if (!authConfigured() || !dbConfigured()) {
    return NextResponse.json({ authEnabled: false, user: null });
  }
  const session = await getSession(req);
  if (!session) return NextResponse.json({ authEnabled: true, user: null });

  // Refresh role/status from the DB so a demotion/disable takes effect promptly.
  const fresh = await getUserById(session.sub).catch(() => null);
  if (!fresh || fresh.status === "disabled") {
    return NextResponse.json({ authEnabled: true, user: null });
  }
  return NextResponse.json({
    authEnabled: true,
    user: { id: fresh.id, email: fresh.email, name: fresh.name, role: fresh.role, image: fresh.image },
  });
}
