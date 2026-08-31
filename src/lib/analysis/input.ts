import type { AnalysisInput } from "./types";

const toStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

/** Normalise a raw request body into a complete AnalysisInput. */
export function buildAnalysisInput(body: Record<string, unknown>): AnalysisInput {
  return {
    title: typeof body.title === "string" ? body.title : "",
    content: typeof body.content === "string" ? body.content : "",
    metaDescription:
      typeof body.metaDescription === "string" ? body.metaDescription : "",
    focusKeyphrase:
      typeof body.focusKeyphrase === "string" ? body.focusKeyphrase : "",
    secondaryKeyphrases: toStringArray(body.secondaryKeyphrases),
    slug: typeof body.slug === "string" ? body.slug : "",
    tags: toStringArray(body.tags),
    categories: toStringArray(body.categories),
    siteDomain:
      (typeof body.siteDomain === "string" && body.siteDomain) ||
      process.env.SITE_DOMAIN ||
      undefined,
  };
}
