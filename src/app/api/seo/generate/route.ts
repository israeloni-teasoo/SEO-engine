import { NextResponse } from "next/server";
import { deriveSeo } from "@/lib/seo/derive";
import { generateSeoWithAi } from "@/lib/ai/generate-seo";
import { aiConfigured } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generate focus keyphrase, secondary keyphrases, tags, meta description and slug
// from the written article. Uses AI when configured, otherwise a free rule-based
// extractor. Always returns a result.
export async function POST(req: Request) {
  let body: { title?: string; content?: string; siteDomain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const title = body.title ?? "";
  const content = body.content ?? "";
  const siteDomain = body.siteDomain || process.env.SITE_DOMAIN || undefined;

  if (!content.trim()) {
    return NextResponse.json({ error: "Write some content first." }, { status: 400 });
  }

  // Rule-based baseline (also the fallback if AI fails).
  const rules = deriveSeo({ title, content, siteDomain });

  if (aiConfigured()) {
    try {
      const ai = await generateSeoWithAi({ title, content });
      // Backfill any empty AI fields from the rule-based result.
      return NextResponse.json({
        source: "ai",
        seo: {
          focusKeyphrase: ai.focusKeyphrase || rules.focusKeyphrase,
          secondaryKeyphrases: ai.secondaryKeyphrases.length ? ai.secondaryKeyphrases : rules.secondaryKeyphrases,
          tags: ai.tags.length ? ai.tags : rules.tags,
          metaDescription: ai.metaDescription || rules.metaDescription,
          slug: ai.slug || rules.slug,
        },
      });
    } catch (e) {
      return NextResponse.json({ source: "rules", seo: rules, aiError: (e as Error).message });
    }
  }

  return NextResponse.json({ source: "rules", seo: rules });
}
