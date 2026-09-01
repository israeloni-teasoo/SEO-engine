import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { suggestEdits } from "@/lib/ai/suggest-edits";
import { aiConfigured, AiNotConfiguredError } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!aiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured. Add GEMINI_API_KEY (free), ANTHROPIC_API_KEY, or OPENAI_API_KEY." },
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
  if (!input.content.trim()) {
    return NextResponse.json({ error: "Write some content first." }, { status: 400 });
  }
  try {
    const analysis = analyze(input);
    const edits = await suggestEdits(input, analysis);
    return NextResponse.json({ edits });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: `Could not build suggestions: ${(e as Error).message}` }, { status: 500 });
  }
}
