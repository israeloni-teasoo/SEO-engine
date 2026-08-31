import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/guard";
import { canEditArticle, isAdmin } from "@/lib/auth/rbac";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { getArticle, updateArticle, deleteArticle } from "@/lib/db/articles";

export const runtime = "nodejs";

function enabled() {
  return authConfigured() && dbConfigured();
}
const toArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!enabled()) return NextResponse.json({ error: "Not enabled." }, { status: 503 });
  try {
    const user = await requireUser(req);
    const article = await getArticle(params.id);
    if (!article) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    if (!canEditArticle(user, article.authorId)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    return NextResponse.json({ article });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!enabled()) return NextResponse.json({ error: "Not enabled." }, { status: 503 });
  try {
    const user = await requireUser(req);
    const existing = await getArticle(params.id);
    if (!existing) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    if (!canEditArticle(user, existing.authorId)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    const b = (await req.json()) as Record<string, unknown>;
    const article = await updateArticle(params.id, {
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!enabled()) return NextResponse.json({ error: "Not enabled." }, { status: 503 });
  try {
    const user = await requireUser(req);
    const existing = await getArticle(params.id);
    if (!existing) return NextResponse.json({ error: "Article not found." }, { status: 404 });
    if (!(isAdmin(user) || existing.authorId === user.sub)) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }
    await deleteArticle(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
