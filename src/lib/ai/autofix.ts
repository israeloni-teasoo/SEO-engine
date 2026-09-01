import type { AnalysisInput, AnalysisResult, CheckResult } from "../analysis/types";
import { generateText, extractJson } from "./provider";
import { STYLE_RULES, sanitizeAiText } from "./style";

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

const SYSTEM = `You are an elite SEO copy editor. Rewrite the draft so it scores 90+ out of 100 on
on-page SEO AND readability, while keeping the author's meaning, voice, facts, and intent intact.
Optimize EVERY component, not just the body — the title, every heading, the intro, the meta
description, the slug, image alt text, tags, category, and the keyphrases.

Hard requirements (each maps to a scored check — satisfy ALL of them):
- PRESERVE the content format. If the body is HTML, return HTML; if Markdown, return Markdown.
- Keep all real facts, data, names, and links. Never fabricate statistics, quotes, or sources.
- TITLE: compelling, ~50-60 characters, with the focus keyphrase near the FRONT.
- HEADINGS: use clear H2/H3 subheadings (never an H1 inside the body — the title is the H1);
  keep the hierarchy sequential; put the focus keyphrase in at least one subheading and a
  secondary keyphrase in another. Add subheadings if the draft lacks them (aim for one every
  ~200-300 words).
- INTRO: use the focus keyphrase within the first 100 words.
- KEYPHRASE DENSITY: 0.8-2.0% for the focus keyphrase — enough to signal relevance, never stuffed.
- Ensure EACH secondary keyphrase appears at least once in the body.
- READABILITY: short sentences (few over 20 words), active voice (<10% passive), 30%+ of
  sentences with transition words, short paragraphs (<150 words), varied sentence openings.
- LENGTH: at least 600 words of genuine, useful content (expand thin sections with real
  substance — never filler).
- LINKS: include at least one internal link (relative, e.g. /related-post) and one outbound
  link to an authoritative source, where natural.
- IMAGES: keep existing images; give every image descriptive alt text (include the keyphrase
  in one where natural).
- META DESCRIPTION: 120-158 characters, includes the focus keyphrase, click-worthy.
- SLUG: short, kebab-case, contains the focus keyphrase, no stop words.
- TAGS: 8-15 specific, relevant tags. CATEGORY: one primary category.
- SECONDARY KEYPHRASES: 2-4 related search phrases, each used in the body.

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

  const text = await generateText({
    system: `${SYSTEM}\n\n${STYLE_RULES}`,
    prompt: brief,
    maxTokens: 16000,
    json: true,
  });
  const parsed = extractJson<Partial<AutoFixResult>>(text);
  const arr = (v: unknown, fallback: string[]) =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : fallback;
  return {
    title: sanitizeAiText(parsed.title ?? input.title),
    metaDescription: sanitizeAiText(parsed.metaDescription ?? input.metaDescription ?? ""),
    slug: parsed.slug ?? input.slug ?? "",
    focusKeyphrase: parsed.focusKeyphrase ?? input.focusKeyphrase ?? "",
    secondaryKeyphrases: arr(parsed.secondaryKeyphrases, input.secondaryKeyphrases ?? []),
    tags: arr(parsed.tags, input.tags ?? []),
    categories: arr(parsed.categories, input.categories ?? []),
    content: sanitizeAiText(parsed.content ?? input.content),
    changes: Array.isArray(parsed.changes) ? parsed.changes : [],
  };
}
