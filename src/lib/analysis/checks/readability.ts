import type { CheckResult, ParsedContent } from "../types";
import { THRESHOLDS } from "../config";
import {
  countSyllables,
  fleschReadingEase,
  hasTransitionWord,
  isPassiveSentence,
  tokenizeWords,
} from "../text-stats";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function readabilityChecks(parsed: ParsedContent): CheckResult[] {
  const { sentences, words, paragraphs, headings } = parsed;
  const checks: CheckResult[] = [];

  // 1. Flesch Reading Ease -----------------------------------------------------
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const flesch = fleschReadingEase({
    wordCount: words.length,
    sentenceCount: sentences.length,
    syllableCount: syllables,
  });
  {
    const { good, ok } = THRESHOLDS.flesch;
    const status = flesch >= good ? "good" : flesch >= ok ? "ok" : "bad";
    checks.push({
      id: "flesch-reading-ease",
      category: "readability",
      label: "Flesch reading ease",
      weight: 2,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? `Reading ease is ${flesch} — comfortable for a general audience.`
          : `Reading ease is ${flesch} (aim for ${good}+). Shorten sentences and prefer simpler words.`,
    });
  }

  // 2. Sentence length ---------------------------------------------------------
  {
    const { maxSentenceWords, goodPct, okPct } = THRESHOLDS.sentenceLength;
    const longCount = sentences.filter(
      (s) => tokenizeWords(s).length > maxSentenceWords,
    ).length;
    const share = sentences.length ? longCount / sentences.length : 0;
    const status = share <= goodPct ? "good" : share <= okPct ? "ok" : "bad";
    checks.push({
      id: "sentence-length",
      category: "readability",
      label: "Sentence length",
      weight: 1.5,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? `${pct(share)} of sentences exceed ${maxSentenceWords} words — nicely concise.`
          : `${pct(share)} of sentences exceed ${maxSentenceWords} words (keep under ${pct(goodPct)}). Break long sentences up.`,
    });
  }

  // 3. Paragraph length --------------------------------------------------------
  {
    const { maxWords } = THRESHOLDS.paragraph;
    const longParas = paragraphs.filter(
      (p) => tokenizeWords(p).length > maxWords,
    ).length;
    const status = longParas === 0 ? "good" : longParas <= 1 ? "ok" : "bad";
    checks.push({
      id: "paragraph-length",
      category: "readability",
      label: "Paragraph length",
      weight: 1,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? "No overly long paragraphs — easy to scan."
          : `${longParas} paragraph(s) exceed ${maxWords} words. Split them into smaller chunks.`,
    });
  }

  // 4. Subheading distribution -------------------------------------------------
  {
    const { maxWords, minContentWords } = THRESHOLDS.subheadingDistribution;
    const longestRun = longestWordsBetweenHeadings(parsed);
    let status: CheckResult["status"] = "good";
    let message = "Subheadings break up the text at healthy intervals.";
    if (words.length >= minContentWords && headings.length === 0) {
      status = "bad";
      message = `This ${words.length}-word post has no subheadings. Add H2/H3 headings to structure it.`;
    } else if (longestRun > maxWords) {
      status = longestRun > maxWords * 1.5 ? "bad" : "ok";
      message = `Up to ${longestRun} words run without a subheading (keep under ${maxWords}). Add more H2/H3 headings.`;
    }
    checks.push({
      id: "subheading-distribution",
      category: "readability",
      label: "Subheading distribution",
      weight: 1.5,
      aiFixable: true,
      status,
      message,
    });
  }

  // 5. Passive voice -----------------------------------------------------------
  {
    const { goodPct, okPct } = THRESHOLDS.passiveVoice;
    const passive = sentences.filter(isPassiveSentence).length;
    const share = sentences.length ? passive / sentences.length : 0;
    const status = share <= goodPct ? "good" : share <= okPct ? "ok" : "bad";
    checks.push({
      id: "passive-voice",
      category: "readability",
      label: "Passive voice",
      weight: 1,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? `${pct(share)} of sentences use passive voice — within the ${pct(goodPct)} target.`
          : `${pct(share)} of sentences use passive voice (target under ${pct(goodPct)}). Rewrite in active voice.`,
    });
  }

  // 6. Transition words --------------------------------------------------------
  {
    const { goodPct, okPct } = THRESHOLDS.transitionWords;
    const withTransition = sentences.filter(hasTransitionWord).length;
    const share = sentences.length ? withTransition / sentences.length : 0;
    const status = share >= goodPct ? "good" : share >= okPct ? "ok" : "bad";
    checks.push({
      id: "transition-words",
      category: "readability",
      label: "Transition words",
      weight: 1,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? `${pct(share)} of sentences use transition words — good flow.`
          : `Only ${pct(share)} of sentences use transition words (aim for ${pct(goodPct)}+). Add words like "however", "therefore", "for example".`,
    });
  }

  // 7. Consecutive sentences starting the same way -----------------------------
  {
    const { maxRun } = THRESHOLDS.consecutiveSentences;
    const worstRun = longestSameStartRun(sentences);
    const status = worstRun < maxRun ? "good" : "bad";
    checks.push({
      id: "consecutive-sentences",
      category: "readability",
      label: "Consecutive sentences",
      weight: 0.5,
      aiFixable: true,
      status,
      message:
        status === "good"
          ? "Sentence openings are varied."
          : `${worstRun} sentences in a row start with the same word. Vary your sentence openings.`,
    });
  }

  return checks;
}

function longestSameStartRun(sentences: string[]): number {
  let best = 0;
  let run = 0;
  let prev = "";
  for (const s of sentences) {
    const first = tokenizeWords(s)[0] ?? "";
    if (first && first === prev) {
      run += 1;
    } else {
      run = 1;
      prev = first;
    }
    best = Math.max(best, run);
  }
  return best;
}

/**
 * Approximate the longest stretch of prose between two subheadings by walking
 * paragraphs and resetting the counter whenever a heading's text appears.
 */
function longestWordsBetweenHeadings(parsed: ParsedContent): number {
  const { headings, paragraphs } = parsed;
  if (headings.length === 0) {
    return parsed.words.length;
  }
  const headingTexts = new Set(headings.map((h) => h.text.toLowerCase()));
  let longest = 0;
  let running = 0;
  for (const p of paragraphs) {
    if (headingTexts.has(p.toLowerCase())) {
      longest = Math.max(longest, running);
      running = 0;
      continue;
    }
    running += tokenizeWords(p).length;
  }
  return Math.max(longest, running);
}
