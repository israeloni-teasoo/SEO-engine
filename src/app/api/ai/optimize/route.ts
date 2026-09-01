import { NextResponse } from "next/server";
import { buildAnalysisInput } from "@/lib/analysis/input";
import { optimizeToTarget } from "@/lib/optimize/optimize";
import { aiConfigured, AiNotConfiguredError } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    return NextResponse.json({ error: "Nothing to optimize — content is empty." }, { status: 400 });
  }

  try {
    const result = await optimizeToTarget(
      {
        title: input.title,
        content: input.content,
        metaDescription: input.metaDescription ?? "",
        focusKeyphrase: input.focusKeyphrase ?? "",
        secondaryKeyphrases: input.secondaryKeyphrases ?? [],
        slug: input.slug ?? "",
        tags: input.tags ?? [],
        categories: input.categories ?? [],
        siteDomain: input.siteDomain,
      },
      { target: 90, maxIterations: 3 },
    );

    const { parsed: _p, ...afterLean } = result.analysis;
    const changes = [
      `Ran ${result.iterations} optimization pass(es): ${result.scores.join(" → ")}.`,
      result.reachedTarget
        ? `Reached the 90+ target (final score ${result.analysis.overallScore}).`
        : `Best achievable score this run: ${result.analysis.overallScore}. Some checks may need manual input (e.g. real internal/outbound links).`,
    ];

    return NextResponse.json({
      fixed: { ...result.draft, changes },
      before: { overallScore: result.before },
      after: afterLean,
      reachedTarget: result.reachedTarget,
      iterations: result.iterations,
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: `Optimization failed: ${(e as Error).message}` }, { status: 500 });
  }
}
