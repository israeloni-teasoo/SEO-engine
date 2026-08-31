// Low-level text statistics: tokenization, syllables, Flesch score,
// passive-voice and transition-word heuristics. Deliberately dependency-free
// and deterministic so the checks and tests stay predictable.

/** Split a block of text into sentences. Handles ., !, ? and ellipses. */
export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  // Split on sentence-ending punctuation followed by a space + capital/quote,
  // or end of string. Keeps decimals like "3.5" and abbreviations mostly intact.
  const parts = normalized
    .split(/(?<=[.!?])["')\]]?\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

/** Extract word tokens (letters, digits, internal apostrophes/hyphens). */
export function tokenizeWords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9]+(?:['-][a-z0-9]+)*/gi);
  return matches ? matches.map((w) => w.toLowerCase()) : [];
}

/** Heuristic English syllable counter — good enough for readability scoring. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;

  let cleaned = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  const count = groups ? groups.length : 0;
  return Math.max(1, count);
}

export interface FleschInput {
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
}

/**
 * Flesch Reading Ease: 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words).
 * Higher is easier. 60-70 is "plain English". Clamped to [0, 100].
 */
export function fleschReadingEase({
  wordCount,
  sentenceCount,
  syllableCount,
}: FleschInput): number {
  if (wordCount === 0 || sentenceCount === 0) return 0;
  const score =
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount);
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// A compact list of common English transition/signal words & phrases.
export const TRANSITION_WORDS: string[] = [
  "accordingly", "additionally", "afterward", "also", "although", "as a result",
  "at last", "besides", "but", "certainly", "clearly", "consequently",
  "conversely", "correspondingly", "despite", "earlier", "equally", "especially",
  "eventually", "finally", "first", "firstly", "for example", "for instance",
  "furthermore", "hence", "however", "in addition", "in conclusion", "in contrast",
  "in fact", "in other words", "in particular", "in short", "in summary", "indeed",
  "instead", "later", "likewise", "meanwhile", "moreover", "namely", "nevertheless",
  "next", "nonetheless", "notably", "of course", "on the contrary",
  "on the other hand", "otherwise", "overall", "previously", "rather", "second",
  "secondly", "similarly", "since", "so", "specifically", "still", "subsequently",
  "such as", "than", "that is", "then", "therefore", "third", "thirdly", "thus",
  "to illustrate", "to summarize", "ultimately", "whereas", "while", "yet",
];

/** True if a sentence opens with, or contains, a transition word/phrase. */
export function hasTransitionWord(sentence: string): boolean {
  const s = ` ${sentence.toLowerCase()} `;
  for (const t of TRANSITION_WORDS) {
    if (s.includes(` ${t} `) || s.startsWith(` ${t} `)) return true;
    // Sentence-initial with trailing comma, e.g. "However,".
    if (s.trimStart().startsWith(`${t},`)) return true;
  }
  return false;
}

// Forms of "to be" and auxiliaries that front a passive construction.
const BE_VERBS = [
  "am", "is", "are", "was", "were", "be", "been", "being",
  "get", "gets", "got", "gotten",
];

// Common irregular past participles that don't end in -ed.
const IRREGULAR_PARTICIPLES = new Set([
  "given", "taken", "seen", "known", "shown", "done", "written", "made",
  "held", "found", "built", "sent", "kept", "told", "brought", "bought",
  "caught", "taught", "thought", "sold", "paid", "put", "read", "set", "cut",
  "chosen", "driven", "drawn", "eaten", "fallen", "forgotten", "hidden",
  "broken", "spoken", "stolen", "worn", "born", "beaten", "become",
  "thrown", "flown", "grown", "blown", "sworn", "torn", "risen", "ridden",
  "bitten", "led", "fed", "met", "won", "lost", "spent", "left", "sung",
  "dealt", "meant", "felt", "sent",
]);

/**
 * Heuristic passive-voice detector: a "be"-verb (optionally + adverb) followed
 * by a past participle. Not perfect, but matches how tools like Yoast flag it.
 */
export function isPassiveSentence(sentence: string): boolean {
  const words = tokenizeWords(sentence);
  for (let i = 0; i < words.length - 1; i++) {
    if (!BE_VERBS.includes(words[i])) continue;
    // Allow one adverb between the auxiliary and the participle.
    let j = i + 1;
    if (words[j] && words[j].endsWith("ly")) j++;
    const candidate = words[j];
    if (!candidate) continue;
    const looksParticiple =
      (candidate.endsWith("ed") && candidate.length > 3) ||
      IRREGULAR_PARTICIPLES.has(candidate);
    if (looksParticiple) return true;
  }
  return false;
}

/** Count non-overlapping occurrences of `phrase` within `text` (word-boundary aware). */
export function countPhraseOccurrences(text: string, phrase: string): number {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return 0;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "gi");
  const matches = text.toLowerCase().match(re);
  return matches ? matches.length : 0;
}
