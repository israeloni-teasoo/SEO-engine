// Shared types for the SEO / readability analysis engine.

/** Traffic-light rating for a single check (green / orange / red). */
export type CheckStatus = "good" | "ok" | "bad";

export type CheckCategory = "seo" | "readability";

export interface CheckResult {
  /** Stable identifier, e.g. "flesch-reading-ease". */
  id: string;
  category: CheckCategory;
  /** Short human label, e.g. "Flesch reading ease". */
  label: string;
  status: CheckStatus;
  /** Sentence explaining the result and, when not good, how to improve it. */
  message: string;
  /** Relative importance when computing the category score. Default 1. */
  weight: number;
  /**
   * True when the AI auto-fixer can meaningfully address this issue by
   * rewriting/editing the content. Purely informational for the UI.
   */
  aiFixable: boolean;
}

/** What the user hands the engine. `content` may be Markdown or HTML. */
export interface AnalysisInput {
  title: string;
  content: string;
  metaDescription?: string;
  focusKeyphrase?: string;
  slug?: string;
  /** Bare domain (e.g. "example.com") used to classify internal vs external links. */
  siteDomain?: string;
}

/** Structural facts extracted from the content, reused by many checks. */
export interface ParsedContent {
  /** Plain visible text with tags/markup removed. */
  text: string;
  words: string[];
  sentences: string[];
  paragraphs: string[];
  headings: { level: number; text: string }[];
  images: { src: string; alt: string }[];
  links: { href: string; internal: boolean }[];
  /** Text of the first paragraph (or first ~sentence block). */
  firstParagraph: string;
  wordCount: number;
}

export interface AnalysisResult {
  checks: CheckResult[];
  /** 0-100, weighted over the readability checks. */
  readabilityScore: number;
  /** 0-100, weighted over the SEO checks. */
  seoScore: number;
  /** 0-100, average of the two above. */
  overallScore: number;
  /** Overall traffic light derived from overallScore. */
  overallStatus: CheckStatus;
  metrics: {
    wordCount: number;
    fleschReadingEase: number;
    sentenceCount: number;
    paragraphCount: number;
    keyphraseDensity: number | null;
    keyphraseCount: number | null;
    titleWidthPx: number;
    metaDescriptionLength: number;
    linkCount: number;
    internalLinkCount: number;
    outboundLinkCount: number;
    imageCount: number;
  };
  parsed: ParsedContent;
}
