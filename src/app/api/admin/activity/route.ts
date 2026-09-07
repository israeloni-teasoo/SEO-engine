import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { listActivity } from "@/lib/db/activity";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    const items = await listActivity(100);
    return NextResponse.json({
      activity: items.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        userName: a.userName ?? a.userEmail ?? "system",
        articleTitle: a.articleTitle,
        createdAt: a.createdAt,
      })),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}
