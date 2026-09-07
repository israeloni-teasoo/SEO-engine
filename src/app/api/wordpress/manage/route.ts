import { NextResponse } from "next/server";
import { setPostStatus, deletePost, WordPressError } from "@/lib/wordpress/client";
import type { WordPressCredentials } from "@/lib/wordpress/client";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/guard";
import { canPublish } from "@/lib/auth/rbac";
import { getWordPressConfig } from "@/lib/db/settings";
import { getArticle, setArticleStatus, detachWpPost } from "@/lib/db/articles";
import { logActivity } from "@/lib/db/activity";

export const runtime = "nodejs";

const multiUser = () => authConfigured() && dbConfigured();

interface ManageBody {
  wpPostId?: number;
  action?: "draft" | "publish" | "delete";
  articleId?: string;
  url?: string;
  username?: string;
  applicationPassword?: string;
}

export async function POST(req: Request) {
  let body: ManageBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.wpPostId || !body.action) {
    return NextResponse.json({ error: "wpPostId and action are required." }, { status: 400 });
  }

  // Resolve credentials + permissions.
  let creds: WordPressCredentials | null = null;
  let userId: string | null = null;
  try {
    if (multiUser()) {
      const user = await requireUser(req);
      if (!canPublish(user)) {
        throw new AuthError("Only editors and admins can manage published posts.", 403);
      }
      userId = user.sub;
      creds = await getWordPressConfig();
      if (!creds) {
        return NextResponse.json({ error: "No shared WordPress connection is configured." }, { status: 400 });
      }
    } else {
      creds = {
        url: body.url || process.env.WORDPRESS_URL || "",
        username: body.username || process.env.WORDPRESS_USERNAME || "",
        applicationPassword: body.applicationPassword || process.env.WORDPRESS_APP_PASSWORD || "",
      };
      if (!creds.url || !creds.username || !creds.applicationPassword) {
        return NextResponse.json({ error: "Missing WordPress credentials." }, { status: 400 });
      }
    }
  } catch (e) {
    return authErrorResponse(e);
  }

  try {
    if (body.action === "delete") {
      await deletePost(creds, body.wpPostId);
      if (multiUser() && body.articleId) {
        const article = await getArticle(body.articleId).catch(() => null);
        if (article) {
          await detachWpPost(body.articleId);
          await logActivity({ userId, action: "deleted_wp", articleId: body.articleId, detail: `WP post #${body.wpPostId} deleted` });
        }
      }
      return NextResponse.json({ ok: true, deleted: true });
    }

    // draft | publish
    const post = await setPostStatus(creds, body.wpPostId, body.action);
    if (multiUser() && body.articleId) {
      const article = await getArticle(body.articleId).catch(() => null);
      if (article) {
        await setArticleStatus(body.articleId, body.action === "publish" ? "published" : "draft");
        await logActivity({ userId, action: "status_changed", articleId: body.articleId, detail: `WP post #${body.wpPostId} → ${body.action}` });
      }
    }
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    const status = e instanceof WordPressError ? e.status || 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
