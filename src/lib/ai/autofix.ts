import type { AnalysisInput, AnalysisResult, CheckResult } from "../analysis/types";
import { generateText, extractJson } from "./provider";

export interface AutoFixResult {
  title: string;
  metaDescription: string;
  slug: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string[];
  tags: string[];
  categories: string[];
  content: string;
  changes: string[];
}

const SYSTEM = `You are an expert SEO copy editor. You rewrite blog drafts so they score well on
on-page SEO and readability while keeping the author's meaning, voice, facts, and intent intact.

Rules:
- PRESERVE the content format. If the body is HTML, return HTML; if Markdown, return Markdown.
- Keep all real facts, data, names, and links. Never fabricate statistics, quotes, or sources.
- Improve readability: shorter sentences, active voice, transition words, tighter paragraphs,
  and clear H2/H3 subheadings.
- Improve SEO: use the focus keyphrase naturally in the title, introduction, at least one
  subheading, the meta description, and the slug — without keyword stuffing (density ~0.5-2.5%).
- Keep existing images; add descriptive alt text (include the keyphrase in one where natural).
- SEO title ~50-60 characters; meta description 120-158 characters and click-worthy.
- Suggest 5-10 relevant tags and 1 primary category if none are provided.
- Suggest 2-4 secondary keyphrases and ensure each appears at least once in the body.
- Only change what improves the post. Do not pad word count with fluff.

Respond with ONLY a JSON object (no prose, no code fence):
{
  "title": "...",
  "metaDescription": "...",
  "slug": "kebab-case-slug",
  "focusKeyphrase": "...",
  "secondaryKeyphrases": ["...", "..."],
  "tags": ["...", "..."],
  "categories": ["Primary Category"],
  "content": "the full rewritten body in the original format",
  "changes": ["short description of each notable edit"]
}`;

const issueSummary = (checks: CheckResult[]) =>
  checks.filter((c) => c.status !== "good").map((c) => `- [${c.status}] ${c.label}: ${c.message}`).join("\n");

export async function autoFix(
  input: AnalysisInput,
  analysis: AnalysisResult,
): Promise<AutoFixResult> {
  const brief = [
    `Focus keyphrase: ${input.focusKeyphrase || "(none — choose the best one for this post)"}`,
    `Secondary keyphrases: ${(input.secondaryKeyphrases ?? []).join(", ") || "(none — suggest some)"}`,
    `Current SEO title: ${input.title || "(none)"}`,
    `Current meta description: ${input.metaDescription || "(none)"}`,
    `Current slug: ${input.slug || "(none)"}`,
    `Current tags: ${(input.tags ?? []).join(", ") || "(none — suggest some)"}`,
    `Current categories: ${(input.categories ?? []).join(", ") || "(none — suggest one)"}`,
    "",
    "Issues to fix:",
    issueSummary(analysis.checks) || "- (general polish)",
    "",
    "Body to rewrite (keep this exact format):",
    input.content,
  ].join("\n");

  const text = await generateText({ system: SYSTEM, prompt: brief, maxTokens: 16000, json: true });
  const parsed = extractJson<Partial<AutoFixResult>>(text);
  const arr = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : fallback;
  return {
    title: parsed.title ?? input.title,
    metaDescription: parsed.metaDescription ?? input.metaDescription ?? "",
    slug: parsed.slug ?? input.slug ?? "",
    focusKeyphrase: parsed.focusKeyphrase ?? input.focusKeyphrase ?? "",
    secondaryKeyphrases: arr(parsed.secondaryKeyphrases, input.secondaryKeyphrases ?? []),
    tags: arr(parsed.tags, input.tags ?? []),
    categories: arr(parsed.categories, input.categories ?? []),
    content: parsed.content ?? input.content,
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
  };
}
