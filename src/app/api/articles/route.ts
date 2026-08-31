import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guard";
import { canReview } from "@/lib/auth/rbac";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { listArticles, createArticle, type ArticleStatus } from "@/lib/db/articles";

export const runtime = "nodejs";

function enabled() {
  return authConfigured() && dbConfigured();
}

const toArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

export async function GET(req: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: "Saved articles require accounts (AUTH_SECRET + DATABASE_URL)." }, { status: 503 });
  }
  try {
    const user = await requireUser(req);
    const status = new URL(req.url).searchParams.get("status") as ArticleStatus | null;
    const articles = await listArticles({
      viewerId: user.sub,
      canSeeAll: canReview(user),
      status: status ?? undefined,
    });
    return NextResponse.json({ articles });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function POST(req: Request) {
  if (!enabled()) {
    return NextResponse.json({ error: "Saved articles require accounts (AUTH_SECRET + DATABASE_URL)." }, { status: 503 });
  }
  try {
    const user = await requireUser(req);
    const b = (await req.json()) as Record<string, unknown>;
    const article = await createArticle(user.sub, {
      title: String(b.title ?? ""),
      content: String(b.content ?? ""),
      metaDescription: String(b.metaDescription ?? ""),
      focusKeyphrase: String(b.focusKeyphrase ?? ""),
      secondaryKeyphrases: toArr(b.secondaryKeyphrases),
      slug: String(b.slug ?? ""),
      tags: toArr(b.tags),
      categories: toArr(b.categories),
      overallScore: typeof b.overallScore === "number" ? b.overallScore : null,
    });
    return NextResponse.json({ article });
  } catch (e) {
    return authErrorResponse(e);
  }
}
