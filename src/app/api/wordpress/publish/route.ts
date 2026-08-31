import { NextResponse } from "next/server";
import {
  createPost,
  resolveTerms,
  WordPressError,
} from "@/lib/wordpress/client";
import type {
  WordPressCredentials,
  CreatePostInput,
  SeoMeta,
} from "@/lib/wordpress/client";
import { toHtml } from "@/lib/markdown";
import { submitUrls, hostFromUrl } from "@/lib/indexing/indexnow";

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
  /** Ping IndexNow after a public publish (needs an IndexNow key configured). */
  pingIndexNow?: boolean;
}

export async function POST(req: Request) {
  let body: PublishBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const creds: WordPressCredentials = {
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
  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "A title and content are required to publish." },
      { status: 400 },
    );
  }

  try {
    // Resolve tag/category names to term IDs (creating any that don't exist).
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
        .map((k) => k.trim())
        .filter(Boolean)
        .join(",");
    }

    const post = await createPost(creds, {
      title: body.title,
      content: toHtml(body.content),
      status: body.status ?? "draft",
      slug: body.slug || undefined,
      excerpt: body.metaDescription || undefined,
      date: body.date || undefined,
      tags: tagIds,
      categories: categoryIds,
      meta,
    });

    // Optionally notify IndexNow when the post went live publicly.
    let indexNow = null;
    const key = process.env.INDEXNOW_KEY;
    if (body.pingIndexNow && post.status === "publish" && key && post.link) {
      const host = process.env.INDEXNOW_HOST || hostFromUrl(post.link);
      indexNow = await submitUrls(host, key, [post.link]);
    }

    return NextResponse.json({ ok: true, post, indexNow });
  } catch (e) {
    const status = e instanceof WordPressError ? e.status || 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
