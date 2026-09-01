import type { AnalysisInput, AnalysisResult, CheckResult } from "../analysis/types";
import { generateText, extractJson } from "./provider";
import { STYLE_RULES, sanitizeAiText } from "./style";

export type EditField =
  | "title"
  | "metaDescription"
  | "slug"
  | "focusKeyphrase"
  | "secondaryKeyphrases"
  | "tags"
  | "categories";

export interface SuggestedEdit {
  id: string;
  /** "field" edits set a metadata field; "content" edits replace a text block. */
  type: "field" | "content";
  field?: EditField;
  /** For content edits: the EXACT current text of one paragraph/heading. */
  original: string;
  /** The improved replacement text (plain text). */
  suggested: string;
  /** Short reason shown to the user. */
  reason: string;
}

const SYSTEM = `You are an SEO editor proposing SPECIFIC, ACCEPT-OR-REJECT edits to a blog post.
Do NOT rewrite the whole article. Instead return a list of atomic edits the author can accept or
ignore individually. Each edit either changes one metadata field OR replaces exactly one
paragraph/heading.

For CONTENT edits:
- "original" MUST be the exact, verbatim text of a single existing paragraph or heading (plain
  text, no HTML). Copy it precisely so it can be located in the document.
- "suggested" is the improved version of just that block.
- Only propose a content edit where it materially improves SEO or readability (a weak heading, a
  long/passive/unclear sentence, an intro missing the keyphrase, etc.).

For FIELD edits, use field one of: title, metaDescription, slug, focusKeyphrase,
secondaryKeyphrases, tags, categories. For tags/secondaryKeyphrases/categories, "suggested" is a
comma-separated list.

Return ONLY JSON (no prose, no code fence):
{ "edits": [ { "type": "content|field", "field": "<field or omit>", "original": "...", "suggested": "...", "reason": "<one short line>" } ] }
Return at most 25 edits, most impactful first.`;

const failing = (checks: CheckResult[]) => checks.filter((c) => c.status !== "good");

export async function suggestEdits(
  input: AnalysisInput,
  analysis: AnalysisResult,
): Promise<SuggestedEdit[]> {
  const issues = failing(analysis.checks).map((c) => `- ${c.label}: ${c.message}`).join("\n");
  const prompt = [
    `Current title: ${input.title}`,
    `Current meta description: ${input.metaDescription || "(none)"}`,
    `Current slug: ${input.slug || "(none)"}`,
    `Focus keyphrase: ${input.focusKeyphrase || "(none)"}`,
    `Secondary keyphrases: ${(input.secondaryKeyphrases ?? []).join(", ") || "(none)"}`,
    `Tags: ${(input.tags ?? []).join(", ") || "(none)"}`,
    `Categories: ${(input.categories ?? []).join(", ") || "(none)"}`,
    "",
    "Issues to address:",
    issues || "(general polish)",
    "",
    "Article body (HTML):",
    input.content,
  ].join("\n");

  const text = await generateText({
    system: `${SYSTEM}\n\n${STYLE_RULES}`,
    prompt,
    maxTokens: 8000,
    json: true,
  });

  const parsed = extractJson<{ edits?: Partial<SuggestedEdit>[] }>(text);
  const raw = Array.isArray(parsed.edits) ? parsed.edits : [];

  return raw
    .filter((e) => e && typeof e.suggested === "string" && e.suggested.trim())
    .map((e, i): SuggestedEdit => ({
      id: `edit-${i}`,
      type: e.type === "field" ? "field" : "content",
      field: e.field,
      original: sanitizeAiText(String(e.original ?? "")).trim(),
      suggested: sanitizeAiText(String(e.suggested ?? "")).trim(),
      reason: String(e.reason ?? "").trim(),
    }))
    // A content edit with no locatable original is useless; keep field edits regardless.
    .filter((e) => e.type === "field" || e.original.length > 0);
}
