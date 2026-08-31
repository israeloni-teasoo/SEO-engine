import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { getUserById, setUserRole, setUserStatus, listUsers } from "@/lib/db/users";
import type { Role } from "@/lib/auth/session";

export const runtime = "nodejs";

const ROLES: Role[] = ["admin", "editor", "author"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const admin = await requireRole(req, "admin");
    const target = await getUserById(params.id);
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    let body: { role?: Role; status?: "active" | "disabled" };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // Guard against locking out the last admin (and self-lockout).
    const isSelf = admin.sub === target.id;
    const demoting = body.role && body.role !== "admin" && target.role === "admin";
    const disabling = body.status === "disabled" && target.role === "admin";
    if ((demoting || disabling) && target.role === "admin") {
      const admins = (await listUsers()).filter(
        (u) => u.role === "admin" && u.status === "active",
      );
      if (admins.length <= 1) {
        return NextResponse.json(
          { error: "Can't remove the last active admin." },
          { status: 400 },
        );
      }
    }
    if (isSelf && body.status === "disabled") {
      return NextResponse.json({ error: "You can't disable your own account." }, { status: 400 });
    }

    if (body.role) {
      if (!ROLES.includes(body.role)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      await setUserRole(target.id, body.role);
    }
    if (body.status) {
      await setUserStatus(target.id, body.status);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
