import { NextResponse } from "next/server";
import { createPost, WordPressError } from "@/lib/wordpress/client";
import type { WordPressCredentials, CreatePostInput } from "@/lib/wordpress/client";
import { toHtml } from "@/lib/markdown";

export const runtime = "nodejs";
export const maxDuration = 120;

interface PublishBody extends Partial<WordPressCredentials> {
  title?: string;
  content?: string;
  metaDescription?: string;
  slug?: string;
  status?: CreatePostInput["status"];
  date?: string;
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
    const post = await createPost(creds, {
      title: body.title,
      content: toHtml(body.content),
      status: body.status ?? "draft",
      slug: body.slug || undefined,
      excerpt: body.metaDescription || undefined,
      date: body.date || undefined,
    });
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    const status = e instanceof WordPressError ? e.status || 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
