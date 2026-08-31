import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import { buildAnalysisInput } from "@/lib/analysis/input";
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = buildAnalysisInput(body);

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
