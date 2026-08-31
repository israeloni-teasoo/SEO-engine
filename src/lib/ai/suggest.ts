import type { AnalysisInput, AnalysisResult, CheckResult } from "../analysis/types";
import { AI_MODEL, extractJson, getClient, textOf } from "./client";

export interface Suggestion {
  /** The check id this addresses, when applicable. */
  checkId?: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

const SYSTEM = `You are an expert SEO editor and content strategist who helps writers
improve blog posts for organic search (Google) and for engagement on WordPress and LinkedIn.
You understand on-page SEO, E-E-A-T, search intent, readability, and helpful-content principles.

You are given a draft post and the results of a rule-based analysis. Produce specific,
actionable suggestions a writer can apply. Prioritise changes that most improve reach and
ranking. Be concrete: reference the actual text, propose exact wording where useful, and avoid
generic advice. Do not invent facts about the author's business.

Respond with ONLY a JSON object of this shape (no prose, no code fence):
{
  "suggestions": [
    { "checkId": "<id or omit>", "title": "<short imperative>", "detail": "<1-3 sentences, concrete>", "priority": "high|medium|low" }
  ]
}`;

function failing(checks: CheckResult[]): CheckResult[] {
  return checks.filter((c) => c.status !== "good");
}

export async function getSuggestions(
  input: AnalysisInput,
  analysis: AnalysisResult,
): Promise<Suggestion[]> {
  const client = getClient();
  const issues = failing(analysis.checks).map((c) => ({
    id: c.id,
    label: c.label,
    status: c.status,
    note: c.message,
  }));

  const userContent = JSON.stringify(
    {
      title: input.title,
      focusKeyphrase: input.focusKeyphrase ?? null,
      metaDescription: input.metaDescription ?? null,
      slug: input.slug ?? null,
      scores: {
        overall: analysis.overallScore,
        seo: analysis.seoScore,
        readability: analysis.readabilityScore,
      },
      metrics: analysis.metrics,
      failingChecks: issues,
      content: input.content,
    },
    null,
    2,
  );

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Here is the draft and its analysis. Return prioritised suggestions.\n\n${userContent}`,
      },
    ],
  });

  const parsed = extractJson<{ suggestions?: Suggestion[] }>(textOf(response.content));
  return Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
}
