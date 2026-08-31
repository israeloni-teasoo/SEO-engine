// Central place for every threshold the analysis engine uses.
// Values are drawn from widely used SEO/readability guidance (Yoast readability
// analysis, Google Search Central helpful-content guidance, common SERP pixel
// limits). Tune here without touching check logic. See docs/SEO-CRITERIA.md.

export const THRESHOLDS = {
  // --- Readability ---
  flesch: { good: 60, ok: 50 }, // Flesch Reading Ease; >=60 easy to read
  // Share of sentences longer than `maxSentenceWords`.
  sentenceLength: { maxSentenceWords: 20, goodPct: 0.25, okPct: 0.3 },
  // A single paragraph longer than this (in words) is hard to scan.
  paragraph: { maxWords: 150 },
  // Longest run of text between two subheadings, in words.
  subheadingDistribution: { maxWords: 300, minContentWords: 300 },
  // Share of sentences written in passive voice.
  passiveVoice: { goodPct: 0.1, okPct: 0.15 },
  // Share of sentences that contain a transition word.
  transitionWords: { goodPct: 0.3, okPct: 0.2 },
  // Flag N or more consecutive sentences that start with the same word.
  consecutiveSentences: { maxRun: 3 },

  // --- SEO ---
  // Keyphrase density (occurrences / total words).
  keyphraseDensity: { min: 0.005, max: 0.03, hardMax: 0.04 },
  keyphraseLength: { minWords: 1, maxWords: 4 },
  // Keyphrase should appear within the first N words of the body.
  keyphraseFirstParagraphWindow: 120,
  // SEO title rendered width in pixels (Google truncates ~580-600px).
  titleWidthPx: { min: 150, good: 580, hardMax: 600 },
  // Meta description length in characters.
  metaDescription: { min: 120, max: 158, hardMax: 165 },
  // Total body word count.
  wordCount: { min: 300, good: 600, excellent: 900 },
  // Slug length in characters and max stop words allowed.
  slug: { maxChars: 75, maxStopWords: 2 },
} as const;

// Stop words removed from an ideal URL slug (kept short & keyword-focused).
export const SLUG_STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "for", "to", "in", "on", "at", "by", "with",
  "is", "are", "or", "but", "as", "if", "it", "its", "this", "that", "your",
  "you", "we", "our", "from",
]);
