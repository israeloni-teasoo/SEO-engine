import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guard";
import { canEditArticle } from "@/lib/auth/rbac";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { getArticle, setArticleStatus } from "@/lib/db/articles";

export const runtime = "nodejs";

// Author submits a draft for review; editors/admins pick it up from the queue.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!authConfigured() || !dbConfigured()) {
    return NextResponse.json({ error: "Not enabled." }, { status: 503 });
  }
  try {
    const user = await requireUser(req);
    const article = await getArticle(params.id);
    if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    if (!canEditArticle(user, article.authorId)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    if (article.status === "published") {
      return NextResponse.json({ error: "This article is already published." }, { status: 400 });
    }
    await setArticleStatus(params.id, "in_review");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
