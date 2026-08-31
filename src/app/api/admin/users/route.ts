import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { listUsers } from "@/lib/db/users";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    const users = await listUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        image: u.image,
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
