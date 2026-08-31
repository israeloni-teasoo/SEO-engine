import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import type { AnalysisInput } from "@/lib/analysis/types";
import { autoFix } from "@/lib/ai/autofix";
import { aiConfigured, MissingApiKeyError } from "@/lib/ai/client";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Set ANTHROPIC_API_KEY to enable auto-fix." },
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

  if (!input.content.trim()) {
    return NextResponse.json({ error: "Nothing to fix — content is empty." }, { status: 400 });
  }

  try {
    const analysis = analyze(input);
    const fixed = await autoFix(input, analysis);
    // Re-analyze the fixed draft so the UI can show the before/after score jump.
    const after = analyze({
      title: fixed.title,
      content: fixed.content,
      metaDescription: fixed.metaDescription,
      focusKeyphrase: fixed.focusKeyphrase,
      slug: fixed.slug,
      siteDomain: input.siteDomain,
    });
    const { parsed: _p, ...afterLean } = after;
    return NextResponse.json({
      fixed,
      before: { overallScore: analysis.overallScore, seoScore: analysis.seoScore, readabilityScore: analysis.readabilityScore },
      after: afterLean,
    });
  } catch (e) {
    if (e instanceof MissingApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: `Auto-fix failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
