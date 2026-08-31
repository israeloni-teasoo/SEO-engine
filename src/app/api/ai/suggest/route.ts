import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import type { AnalysisInput } from "@/lib/analysis/types";
import { getSuggestions } from "@/lib/ai/suggest";
import { aiConfigured, MissingApiKeyError } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY to enable suggestions." },
      { status: 503 },
    );
  }

  let body: Partial<AnalysisInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input: AnalysisInput = {
    title: body.title ?? "",
    content: body.content ?? "",
    metaDescription: body.metaDescription ?? "",
    focusKeyphrase: body.focusKeyphrase ?? "",
    slug: body.slug ?? "",
    siteDomain: body.siteDomain || process.env.SITE_DOMAIN || undefined,
  };

  try {
    const analysis = analyze(input);
    const suggestions = await getSuggestions(input, analysis);
    return NextResponse.json({ suggestions });
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Could not generate suggestions: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
