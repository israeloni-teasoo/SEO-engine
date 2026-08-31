import { NextResponse } from "next/server";
import { generateAltTextForContent } from "@/lib/ai/alt-text";
import { aiConfigured, MissingApiKeyError } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY to generate alt text." },
      { status: 503 },
    );
  }

  let body: {
    content?: string;
    focusKeyphrase?: string;
    title?: string;
    siteDomain?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "No content provided." }, { status: 400 });
  }

  try {
    const result = await generateAltTextForContent(body.content, {
      keyphrase: body.focusKeyphrase,
      title: body.title,
      siteDomain: body.siteDomain || process.env.SITE_DOMAIN || undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Alt text generation failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
