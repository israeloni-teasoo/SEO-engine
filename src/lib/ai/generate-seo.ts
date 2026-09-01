import { generateText, extractJson } from "./provider";
import { slugify, type DerivedSeo } from "../seo/derive";

const SYSTEM = `You are an SEO strategist. Given a blog article (title + body), produce the SEO
metadata a writer would set in WordPress. Base everything on the ACTUAL content — do not invent
topics the article doesn't cover.

Return ONLY JSON (no prose, no code fence):
{
  "focusKeyphrase": "the single best 2-4 word phrase this article should rank for",
  "secondaryKeyphrases": ["2-4 related search phrases actually covered"],
  "tags": ["8-15 relevant WordPress tags, Title Case, specific not generic"],
  "metaDescription": "a compelling 120-158 character summary that includes the focus keyphrase",
  "slug": "kebab-case-url-slug"
}`;

export async function generateSeoWithAi(input: {
  title: string;
  content: string;
}): Promise<DerivedSeo> {
  const prompt = `Title: ${input.title || "(untitled)"}\n\nArticle:\n${input.content}`;
  const text = await generateText({ system: SYSTEM, prompt, maxTokens: 1500, json: true });
  const p = extractJson<Partial<DerivedSeo>>(text);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    focusKeyphrase: (p.focusKeyphrase ?? "").trim(),
    secondaryKeyphrases: arr(p.secondaryKeyphrases),
    tags: arr(p.tags),
    metaDescription: (p.metaDescription ?? "").trim(),
    slug: p.slug ? slugify(p.slug) : slugify(input.title),
  };
}
