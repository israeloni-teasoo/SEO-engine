// Headline quality analysis, modelled on the CoSchedule/AIOSEO headline
// analyzer: balance of common vs uncommon words, emotional and power words, and
// overall sentiment. Used to score the title and to steer AI title rewrites.

import { tokenizeWords } from "./text-stats";

// ~120 most common English words (function words + very frequent words).
const COMMON = new Set([
  "the","a","an","and","or","but","if","of","to","in","on","at","by","for","with",
  "about","as","into","like","through","after","over","between","out","against",
  "is","are","was","were","be","been","being","am","do","does","did","have","has",
  "had","can","could","will","would","should","may","might","must","shall",
  "you","your","yours","we","our","ours","i","me","my","he","she","it","they",
  "them","their","this","that","these","those","what","which","who","how","why",
  "when","where","not","no","yes","so","up","down","now","then","here","there",
  "all","any","some","more","most","other","new","good","get","make","made","use",
  "way","ways","best","top","how","need","want","from","one","two","are","become",
  "becoming","why","are",
]);

// Emotional words (trigger feeling).
const EMOTIONAL = new Set([
  "amazing","surprising","shocking","stunning","incredible","unbelievable","urgent",
  "critical","dangerous","risky","risk","fear","threat","warning","crisis","fail",
  "failure","mistake","struggle","worry","hope","trust","safe","protect","win",
  "winning","success","successful","breakthrough","transform","transformative",
  "powerful","surprise","secret","hidden","truth","proven","smart","bold","brave",
  "vital","essential","crucial","alarming","booming","soaring","collapse","warning",
]);

// Power words (drive clicks / authority).
const POWER = new Set([
  "proven","ultimate","essential","guaranteed","effortless","instant","exclusive",
  "unstoppable","gatekeeper","gatekeepers","definitive","complete","powerful","secret",
  "breakthrough","revolutionary","game-changing","insider","step-by-step","free",
  "critical","urgent","surprising","hidden","new","must","stop","avoid","never",
  "always","now","today","fast","proven","boost","master","unlock","dominate",
]);

const POSITIVE = new Set([
  "win","winning","success","successful","boost","soaring","booming","growth","gain",
  "best","better","improve","improved","opportunity","proven","transform","rise",
  "strong","safe","trust","hope","smart","effortless","powerful","breakthrough",
]);
const NEGATIVE = new Set([
  "fail","failure","risk","risky","danger","dangerous","threat","crisis","collapse",
  "loss","lose","losing","warning","mistake","struggle","fear","worry","alarming",
  "decline","weak","costly","trap","avoid","stop","never",
]);

export interface HeadlineAnalysis {
  wordCount: number;
  commonPct: number;
  uncommonPct: number;
  emotionalPct: number;
  powerCount: number;
  sentiment: "positive" | "negative" | "neutral";
}

export function analyzeHeadline(title: string): HeadlineAnalysis {
  const words = tokenizeWords(title);
  const n = words.length;
  if (n === 0) {
    return { wordCount: 0, commonPct: 0, uncommonPct: 0, emotionalPct: 0, powerCount: 0, sentiment: "neutral" };
  }
  let common = 0, emotional = 0, power = 0, pos = 0, neg = 0;
  for (const w of words) {
    if (COMMON.has(w)) common++;
    if (EMOTIONAL.has(w)) emotional++;
    if (POWER.has(w)) power++;
    if (POSITIVE.has(w)) pos++;
    if (NEGATIVE.has(w)) neg++;
  }
  // Uncommon = content words that aren't common function words (and not pure numbers).
  const uncommon = words.filter((w) => !COMMON.has(w) && !/^\d+$/.test(w)).length;
  const sentiment: HeadlineAnalysis["sentiment"] =
    neg > pos ? "negative" : pos > neg ? "positive" : "neutral";

  return {
    wordCount: n,
    commonPct: Math.round((common / n) * 100),
    uncommonPct: Math.round((uncommon / n) * 100),
    emotionalPct: Math.round((emotional / n) * 100),
    powerCount: power,
    sentiment,
  };
}

/** Short, human list of what a headline is missing (for prompts + the UI check). */
export function headlineGaps(h: HeadlineAnalysis): string[] {
  const gaps: string[] = [];
  if (h.powerCount < 1) gaps.push("add at least one power word (e.g. proven, essential, ultimate)");
  if (h.emotionalPct < 10) gaps.push("add an emotional word (e.g. surprising, critical, risky)");
  if (h.commonPct < 20) gaps.push("include a few more common words for natural flow");
  if (h.uncommonPct < 10) gaps.push("add a distinctive/uncommon word");
  if (h.sentiment === "neutral") gaps.push("give it a clearer positive or negative angle");
  return gaps;
}
