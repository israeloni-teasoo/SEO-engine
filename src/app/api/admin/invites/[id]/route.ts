import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { deleteInvite } from "@/lib/db/invites";

export const runtime = "nodejs";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(req, "admin");
    await deleteInvite(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
