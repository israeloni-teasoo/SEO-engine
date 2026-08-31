import { NextResponse } from "next/server";
import { generateLinkedInPost } from "@/lib/ai/linkedin-post";
import { aiConfigured, MissingApiKeyError } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY to draft LinkedIn posts." },
      { status: 503 },
    );
  }
  let body: { title?: string; content?: string; focusKeyphrase?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "No content provided." }, { status: 400 });
  }
  try {
    const text = await generateLinkedInPost({
      title: body.title ?? "",
      content: body.content,
      focusKeyphrase: body.focusKeyphrase,
      url: body.url,
    });
    return NextResponse.json({ text });
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Could not draft LinkedIn post: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
