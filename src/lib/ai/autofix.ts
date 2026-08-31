import type { AnalysisInput, AnalysisResult, CheckResult } from "../analysis/types";
import { AI_MODEL, extractJson, getClient, textOf } from "./client";

export interface AutoFixResult {
  title: string;
  metaDescription: string;
  slug: string;
  focusKeyphrase: string;
  /** Rewritten body in the SAME format (Markdown or HTML) as the input. */
  content: string;
  /** Human-readable list of the edits that were made. */
  changes: string[];
}

const SYSTEM = `You are an expert SEO copy editor. You rewrite blog drafts so they score well on
on-page SEO and readability while keeping the author's meaning, voice, facts, and intent intact.

Rules:
- PRESERVE the content format. If the body is Markdown, return Markdown; if it is HTML, return HTML.
- Keep all real facts, data, names, and links. Never fabricate statistics, quotes, or sources.
- Improve readability: shorter sentences, active voice, transition words, tighter paragraphs,
  and clear H2/H3 subheadings.
- Improve SEO: use the focus keyphrase naturally in the title, introduction, at least one
  subheading, the meta description, and the slug — without keyword stuffing (keep density ~0.5-2.5%).
- Keep any existing images; add descriptive alt text (include the keyphrase in one where natural).
- The SEO title should be compelling and roughly 50-60 characters. The meta description should be
  120-158 characters and invite the click.
- Only change what improves the post. Do not pad word count with fluff.

Respond with ONLY a JSON object (no prose, no code fence):
{
  "title": "...",
  "metaDescription": "...",
  "slug": "kebab-case-slug",
  "focusKeyphrase": "...",
  "content": "the full rewritten body in the original format",
  "changes": ["short description of each notable edit"]
}`;

function issueSummary(checks: CheckResult[]): string {
  return checks
    .filter((c) => c.status !== "good")
    .map((c) => `- [${c.status}] ${c.label}: ${c.message}`)
    .join("\n");
}

export async function autoFix(
  input: AnalysisInput,
  analysis: AnalysisResult,
): Promise<AutoFixResult> {
  const client = getClient();

  const brief = [
    `Focus keyphrase: ${input.focusKeyphrase || "(none — choose the best one for this post)"}`,
    `Current SEO title: ${input.title || "(none)"}`,
    `Current meta description: ${input.metaDescription || "(none)"}`,
    `Current slug: ${input.slug || "(none)"}`,
    "",
    "Issues to fix:",
    issueSummary(analysis.checks) || "- (general polish)",
    "",
    "Body to rewrite (keep this exact format):",
    input.content,
  ].join("\n");

  // Stream to comfortably handle long rewrites without hitting HTTP timeouts.
  const stream = client.messages.stream({
    model: AI_MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: brief }],
  });
  const response = await stream.finalMessage();

  const parsed = extractJson<Partial<AutoFixResult>>(textOf(response.content));
  return {
    title: parsed.title ?? input.title,
    metaDescription: parsed.metaDescription ?? input.metaDescription ?? "",
    slug: parsed.slug ?? input.slug ?? "",
    focusKeyphrase: parsed.focusKeyphrase ?? input.focusKeyphrase ?? "",
    content: parsed.content ?? input.content,
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
  };
}
