import type {
  AnalysisInput,
  AnalysisResult,
  CheckResult,
  CheckStatus,
} from "./types";
import { parseContent } from "./parse";
import { readabilityChecks } from "./checks/readability";
import { seoChecks, estimateTitleWidthPx } from "./checks/seo";
import {
  countPhraseOccurrences,
  countSyllables,
  fleschReadingEase,
} from "./text-stats";

export * from "./types";

const STATUS_POINTS: Record<CheckStatus, number> = {
  good: 100,
  ok: 55,
  bad: 0,
};

function weightedScore(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 0;
  const earned = checks.reduce(
    (s, c) => s + STATUS_POINTS[c.status] * c.weight,
    0,
  );
  return Math.round(earned / totalWeight);
}

function statusFromScore(score: number): CheckStatus {
  if (score >= 75) return "good";
  if (score >= 50) return "ok";
  return "bad";
}

/**
 * Run the full rule-based analysis. Pure and synchronous — no network, no AI.
 * The AI layer consumes this result to prioritise its suggestions.
 */
export function analyze(input: AnalysisInput): AnalysisResult {
  const parsed = parseContent(input.content, input.siteDomain);

  const readability = readabilityChecks(parsed);
  const seo = seoChecks(input, parsed);
  const checks = [...seo, ...readability];

  const seoScore = weightedScore(seo);
  const readabilityScore = weightedScore(readability);
  const overallScore = Math.round((seoScore + readabilityScore) / 2);

  const syllables = parsed.words.reduce((s, w) => s + countSyllables(w), 0);
  const flesch = fleschReadingEase({
    wordCount: parsed.words.length,
    sentenceCount: parsed.sentences.length,
    syllableCount: syllables,
  });

  const kp = (input.focusKeyphrase ?? "").trim();
  const keyphraseCount = kp ? countPhraseOccurrences(parsed.text, kp) : null;
  const keyphraseDensity =
    kp && parsed.words.length
      ? (keyphraseCount as number) / parsed.words.length
      : null;

  return {
    checks,
    readabilityScore,
    seoScore,
    overallScore,
    overallStatus: statusFromScore(overallScore),
    metrics: {
      wordCount: parsed.wordCount,
      fleschReadingEase: flesch,
      sentenceCount: parsed.sentences.length,
      paragraphCount: parsed.paragraphs.length,
      keyphraseDensity,
      keyphraseCount,
      titleWidthPx: estimateTitleWidthPx(input.title ?? ""),
      metaDescriptionLength: (input.metaDescription ?? "").trim().length,
      linkCount: parsed.links.length,
      internalLinkCount: parsed.links.filter((l) => l.internal).length,
      outboundLinkCount: parsed.links.filter((l) => !l.internal).length,
      imageCount: parsed.images.length,
      imagesMissingAlt: parsed.images.filter((i) => !i.alt).length,
      tagCount: (input.tags ?? []).filter((t) => t.trim()).length,
      categoryCount: (input.categories ?? []).filter((c) => c.trim()).length,
      secondaryKeyphraseCount: (input.secondaryKeyphrases ?? []).filter((k) =>
        k.trim(),
      ).length,
    },
    parsed,
  };
}
