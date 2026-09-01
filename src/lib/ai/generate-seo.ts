import { generateText, extractJson } from "./provider";
import { STYLE_RULES, sanitizeAiText } from "./style";
import { slugify, type DerivedSeo } from "../seo/derive";

export interface AiSeo extends DerivedSeo {
  /** A large pool of extra tag/search-keyword ideas the writer can pick from. */
  keywordIdeas: string[];
}

const SYSTEM = `You are an SEO strategist. Given a blog article (title + body), produce the SEO
metadata a writer would set in WordPress. Base everything on the ACTUAL content — do not invent
topics the article doesn't cover. Be generous with tags and keyword ideas.

Return ONLY JSON (no prose, no code fence):
{
  "focusKeyphrase": "the single best 2-4 word phrase this article should rank for",
  "secondaryKeyphrases": ["3-6 related search phrases actually covered"],
  "tags": ["20-40 relevant WordPress tags, Title Case, specific not generic"],
  "keywordIdeas": ["40-80 additional search keywords and long-tail phrases people might search, including question and how-to variants"],
  "metaDescription": "a compelling 120-158 character summary that includes the focus keyphrase",
  "slug": "kebab-case-url-slug"
}`;

export async function generateSeoWithAi(input: {
  title: string;
  content: string;
}): Promise<AiSeo> {
  const prompt = `Title: ${input.title || "(untitled)"}\n\nArticle:\n${input.content}`;
  const text = await generateText({ system: `${SYSTEM}\n\n${STYLE_RULES}`, prompt, maxTokens: 3000, json: true });
  const p = extractJson<Partial<AiSeo>>(text);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
  return {
    focusKeyphrase: (p.focusKeyphrase ?? "").trim(),
    secondaryKeyphrases: arr(p.secondaryKeyphrases),
    tags: arr(p.tags),
    keywordIdeas: arr(p.keywordIdeas),
    metaDescription: sanitizeAiText((p.metaDescription ?? "").trim()),
    slug: p.slug ? slugify(p.slug) : slugify(input.title),
  };
}
