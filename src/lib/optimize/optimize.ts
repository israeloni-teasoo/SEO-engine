import type { AnalysisInput, AnalysisResult } from "../analysis/types";
import { analyze } from "../analysis/index";
import { autoFix } from "../ai/autofix";
import { deriveSeo, slugify } from "../seo/derive";

export interface OptimizeState {
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string[];
  slug: string;
  tags: string[];
  categories: string[];
  siteDomain?: string;
}

export interface OptimizeResult {
  draft: OptimizeState;
  analysis: AnalysisResult;
  before: number;
  iterations: number;
  reachedTarget: boolean;
  scores: number[];
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Deterministically lock in the "mechanical" SEO fields (slug, meta length,
 * tags, category, keyphrases) so those checks always pass — no AI needed.
 */
function backfill(state: OptimizeState): OptimizeState {
  const derived = deriveSeo({ title: state.title, content: state.content, siteDomain: state.siteDomain });
  const out = { ...state };

  if (!out.focusKeyphrase.trim()) out.focusKeyphrase = derived.focusKeyphrase;

  if (out.secondaryKeyphrases.filter(Boolean).length === 0) {
    out.secondaryKeyphrases = derived.secondaryKeyphrases;
  }

  // Slug: ensure present and keyphrase-aligned.
  if (!out.slug.trim()) out.slug = slugify(out.title || out.focusKeyphrase);

  // Meta description: fill if empty, trim if too long.
  if (!out.metaDescription.trim()) out.metaDescription = derived.metaDescription;
  if (out.metaDescription.length > 158) {
    out.metaDescription = `${out.metaDescription.slice(0, 155).replace(/\s+\S*$/, "")}…`;
  }

  // Tags: ensure a healthy set.
  if (out.tags.filter(Boolean).length < 5) {
    const merged = [...new Set([...out.tags, ...derived.tags])].filter(Boolean);
    out.tags = merged.slice(0, 12);
  }

  // Category: ensure at least one.
  if (out.categories.filter(Boolean).length === 0) {
    out.categories = [titleCase(out.focusKeyphrase || out.tags[0] || "General")];
  }

  return out;
}

function toInput(state: OptimizeState): AnalysisInput {
  return { ...state };
}

/**
 * Optimize a draft toward a target score. Applies deterministic metadata fixes,
 * then runs the AI rewrite in a loop (feeding remaining issues back) until the
 * target is met, no further improvement is made, or maxIterations is reached.
 */
export async function optimizeToTarget(
  input: OptimizeState,
  opts: { target?: number; maxIterations?: number } = {},
): Promise<OptimizeResult> {
  const target = opts.target ?? 90;
  const maxIterations = opts.maxIterations ?? 3;

  const before = analyze(toInput(input)).overallScore;

  let draft = backfill(input);
  let analysis = analyze(toInput(draft));
  const scores = [analysis.overallScore];
  let iterations = 0;

  while (analysis.overallScore < target && iterations < maxIterations) {
    const fixed = await autoFix(toInput(draft), analysis);
    const candidate: OptimizeState = backfill({
      title: fixed.title,
      content: fixed.content,
      metaDescription: fixed.metaDescription,
      focusKeyphrase: fixed.focusKeyphrase,
      secondaryKeyphrases: fixed.secondaryKeyphrases,
      slug: fixed.slug,
      tags: fixed.tags,
      categories: fixed.categories,
      siteDomain: draft.siteDomain,
    });
    const next = analyze(toInput(candidate));
    iterations++;
    scores.push(next.overallScore);

    // Accept the candidate if it's at least as good; stop if no gain.
    if (next.overallScore >= analysis.overallScore) {
      draft = candidate;
      analysis = next;
    }
    if (next.overallScore <= scores[scores.length - 2]) break; // plateaued
  }

  return {
    draft,
    analysis,
    before,
    iterations,
    reachedTarget: analysis.overallScore >= target,
    scores,
  };
}
