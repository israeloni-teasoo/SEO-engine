import { NextResponse } from "next/server";
import {
  createPost,
  updatePost,
  resolveTerms,
  WordPressError,
} from "@/lib/wordpress/client";
import type {
  WordPressCredentials,
  CreatePostInput,
  SeoMeta,
} from "@/lib/wordpress/client";
import { prepareContentForWordPress } from "@/lib/wordpress/prepare-content";
import { toHtml } from "@/lib/markdown";
import { submitUrls, hostFromUrl } from "@/lib/indexing/indexnow";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { requireUser, authErrorResponse, AuthError } from "@/lib/auth/guard";
import { canPublish } from "@/lib/auth/rbac";
import { getWordPressConfig } from "@/lib/db/settings";
import { getArticle, setArticleStatus } from "@/lib/db/articles";

export const runtime = "nodejs";
export const maxDuration = 120;

interface PublishBody extends Partial<WordPressCredentials> {
  title?: string;
  seoTitle?: string;
  content?: string;
  metaDescription?: string;
  focusKeyphrase?: string;
  secondaryKeyphrases?: string[];
  slug?: string;
  tags?: string[];
  categories?: string[];
  status?: CreatePostInput["status"];
  date?: string;
  pingIndexNow?: boolean;
  /** When set, marks this saved article as published on success. */
  articleId?: string;
  /** Update this existing WordPress post instead of creating a new one. */
  wpPostId?: number;
}

const multiUser = () => authConfigured() && dbConfigured();

export async function POST(req: Request) {
  let body: PublishBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Resolve credentials + enforce permissions depending on mode.
  let creds: WordPressCredentials | null = null;
  try {
    if (multiUser()) {
      // Multi-user: only editors/admins publish; use the shared company config.
      const user = await requireUser(req);
      if (!canPublish(user)) {
        throw new AuthError(
          "Authors can't publish directly. Submit the article for review instead.",
          403,
        );
      }
      creds = await getWordPressConfig();
      if (!creds) {
        return NextResponse.json(
          { error: "No shared WordPress connection is configured. Ask an admin to set it up." },
          { status: 400 },
        );
      }
    } else {
      // Single-user: credentials come from the request or env defaults.
      creds = {
        url: body.url || process.env.WORDPRESS_URL || "",
        username: body.username || process.env.WORDPRESS_USERNAME || "",
        applicationPassword:
          body.applicationPassword || process.env.WORDPRESS_APP_PASSWORD || "",
      };
      if (!creds.url || !creds.username || !creds.applicationPassword) {
        return NextResponse.json(
          { error: "Missing WordPress URL, username, or application password." },
          { status: 400 },
        );
      }
    }
  } catch (e) {
    return authErrorResponse(e);
  }

  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "A title and content are required to publish." },
      { status: 400 },
    );
  }

  try {
    // Determine whether we're updating an already-published post (no duplicate).
    let existingPostId: number | undefined = typeof body.wpPostId === "number" ? body.wpPostId : undefined;
    let article = null;
    if (multiUser() && body.articleId) {
      article = await getArticle(body.articleId).catch(() => null);
      if (article?.wpPostId) existingPostId = article.wpPostId;
    }

    // Host inline/external images in the WP media library and pick a featured image.
    const prepared = await prepareContentForWordPress(creds, toHtml(body.content));

    const [tagIds, categoryIds] = await Promise.all([
      body.tags?.length ? resolveTerms(creds, "tags", body.tags) : Promise.resolve([]),
      body.categories?.length
        ? resolveTerms(creds, "categories", body.categories)
        : Promise.resolve([]),
    ]);

    const meta: SeoMeta = {};
    if (body.seoTitle || body.title) meta.seo_engine_title = body.seoTitle || body.title;
    if (body.metaDescription) meta.seo_engine_description = body.metaDescription;
    if (body.focusKeyphrase) meta.seo_engine_focus_keyphrase = body.focusKeyphrase;
    if (body.secondaryKeyphrases?.length) {
      meta.seo_engine_secondary_keyphrases = body.secondaryKeyphrases
        .map((k) => k.trim()).filter(Boolean).join(",");
    }

    const postInput = {
      title: body.title,
      content: prepared.html,
      status: body.status ?? "draft",
      slug: body.slug || undefined,
      excerpt: body.metaDescription || undefined,
      date: body.date || undefined,
      tags: tagIds,
      categories: categoryIds,
      meta,
      featured_media: prepared.featuredMediaId,
    };

    const updated = Boolean(existingPostId);
    const post = existingPostId
      ? await updatePost(creds, existingPostId, postInput)
      : await createPost(creds, postInput);

    // Mark the saved article published (multi-user).
    if (multiUser() && body.articleId && post.status === "publish") {
      if (article ?? (await getArticle(body.articleId).catch(() => null))) {
        await setArticleStatus(body.articleId, "published", { wpPostId: post.id, wpLink: post.link });
      }
    }

    let indexNow = null;
    const key = process.env.INDEXNOW_KEY;
    if (body.pingIndexNow && post.status === "publish" && key && post.link) {
      const host = process.env.INDEXNOW_HOST || hostFromUrl(post.link);
      indexNow = await submitUrls(host, key, [post.link]);
    }

    return NextResponse.json({
      ok: true,
      post,
      wpPostId: post.id,
      updated,
      imagesHosted: prepared.uploaded,
      indexNow,
    });
  } catch (e) {
    const status = e instanceof WordPressError ? e.status || 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
