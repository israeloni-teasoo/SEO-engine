import { NextResponse } from "next/server";
import { deriveSeo, deriveKeywordIdeas } from "@/lib/seo/derive";
import { generateSeoWithAi } from "@/lib/ai/generate-seo";
import { aiConfigured } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

const uniqueMerge = (...lists: string[][]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item.trim());
    }
  }
  return out;
};

// Generate focus keyphrase, secondary keyphrases, tags, a big keyword-idea pool,
// meta description and slug from the written article. AI when configured, else a
// free rule-based extractor. Always returns a result.
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

  const rules = deriveSeo({ title, content, siteDomain });
  const ruleIdeas = deriveKeywordIdeas({ title, content, siteDomain }, 150);
  // Always give at least ~12 tags, backfilling from the idea pool.
  const ensureTags = (tags: string[], pool: string[]) =>
    uniqueMerge(tags, pool).slice(0, Math.max(15, tags.length));

  if (aiConfigured()) {
    try {
      const ai = await generateSeoWithAi({ title, content });
      const pool = uniqueMerge(ai.keywordIdeas, ai.tags, ruleIdeas);
      return NextResponse.json({
        source: "ai",
        seo: {
          focusKeyphrase: ai.focusKeyphrase || rules.focusKeyphrase,
          secondaryKeyphrases: ai.secondaryKeyphrases.length ? ai.secondaryKeyphrases : rules.secondaryKeyphrases,
          tags: ensureTags(uniqueMerge(ai.tags, rules.tags), pool),
          metaDescription: ai.metaDescription || rules.metaDescription,
          slug: ai.slug || rules.slug,
        },
        keywordIdeas: pool.slice(0, 200),
      });
    } catch (e) {
      return NextResponse.json({ source: "rules", seo: { ...rules, tags: ensureTags(rules.tags, ruleIdeas) }, keywordIdeas: ruleIdeas, aiError: (e as Error).message });
    }
  }

  return NextResponse.json({ source: "rules", seo: { ...rules, tags: ensureTags(rules.tags, ruleIdeas) }, keywordIdeas: ruleIdeas });
}
