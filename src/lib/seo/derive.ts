// Rule-based SEO metadata generation — NO AI required, fully free.
// Extracts a focus keyphrase, secondary keyphrases, and tags from the article
// using a lightweight RAKE (Rapid Automatic Keyword Extraction) algorithm, and
// derives a meta description and slug from the content.

import { parseContent } from "../analysis/parse";
import { splitSentences } from "../analysis/text-stats";

export interface DerivedSeo {
  focusKeyphrase: string;
  secondaryKeyphrases: string[];
  tags: string[];
  metaDescription: string;
  slug: string;
}

const STOPWORDS = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't",
  "as","at","be","because","been","before","being","below","between","both","but","by","can",
  "can't","cannot","could","couldn't","did","didn't","do","does","doesn't","doing","don't","down",
  "during","each","few","for","from","further","had","hadn't","has","hasn't","have","haven't",
  "having","he","he'd","he'll","he's","her","here","here's","hers","herself","him","himself","his",
  "how","how's","i","i'd","i'll","i'm","i've","if","in","into","is","isn't","it","it's","its",
  "itself","let's","me","more","most","mustn't","my","myself","no","nor","not","of","off","on",
  "once","only","or","other","ought","our","ours","ourselves","out","over","own","same","shan't",
  "she","she'd","she'll","she's","should","shouldn't","so","some","such","than","that","that's",
  "the","their","theirs","them","themselves","then","there","there's","these","they","they'd",
  "they'll","they're","they've","this","those","through","to","too","under","until","up","very",
  "was","wasn't","we","we'd","we'll","we're","we've","were","weren't","what","what's","when",
  "when's","where","where's","which","while","who","who's","whom","why","why's","will","with",
  "won't","would","wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself",
  "yourselves","also","get","got","make","made","just","like","using","use","used","one","two",
  "will","new","need","want","really","way","things","thing","lot","many","much",
]);

interface Phrase {
  text: string;
  words: string[];
}

/** Split text into candidate phrases (runs of non-stopwords), RAKE-style. */
function candidatePhrases(text: string): Phrase[] {
  const phrases: Phrase[] = [];
  // Break on punctuation and stopwords.
  const chunks = text.toLowerCase().split(/[^a-z0-9'’\-\s]+/);
  for (const chunk of chunks) {
    const tokens = chunk.split(/\s+/).filter(Boolean);
    let current: string[] = [];
    const flush = () => {
      if (current.length && current.length <= 4) {
        phrases.push({ text: current.join(" "), words: [...current] });
      }
      current = [];
    };
    for (const raw of tokens) {
      const w = raw.replace(/^[-'’]+|[-'’]+$/g, "");
      if (!w || STOPWORDS.has(w) || w.length < 2 || /^\d+$/.test(w)) {
        flush();
      } else {
        current.push(w);
      }
    }
    flush();
  }
  return phrases;
}

function rankPhrases(text: string, boostTerms: Set<string>): { phrase: string; score: number }[] {
  const phrases = candidatePhrases(text);
  const freq = new Map<string, number>();
  const degree = new Map<string, number>();

  for (const p of phrases) {
    const deg = p.words.length - 1;
    for (const w of p.words) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
      degree.set(w, (degree.get(w) ?? 0) + deg + 1);
    }
  }
  const wordScore = (w: string) => (degree.get(w) ?? 0) / (freq.get(w) ?? 1);

  const seen = new Map<string, number>();
  for (const p of phrases) {
    let score = p.words.reduce((s, w) => s + wordScore(w), 0);
    // Boost phrases whose words appear in the title/headings.
    if (p.words.some((w) => boostTerms.has(w))) score *= 1.5;
    // Prefer 2-3 word phrases slightly over single words.
    if (p.words.length >= 2 && p.words.length <= 3) score *= 1.15;
    const prev = seen.get(p.text) ?? 0;
    seen.set(p.text, Math.max(prev, score));
  }

  return [...seen.entries()]
    .map(([phrase, score]) => ({ phrase, score }))
    .sort((a, b) => b.score - a.score);
}

const titleCase = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase());

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 75)
    .replace(/-$/g, "");
}

function metaFrom(text: string, keyphrase: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  // Prefer an early sentence that mentions the keyphrase.
  const kp = keyphrase.toLowerCase();
  const withKp = sentences.slice(0, 6).find((s) => kp && s.toLowerCase().includes(kp));
  let desc = withKp || sentences[0];
  // Extend with the next sentence if short.
  if (desc.length < 110 && sentences[1]) desc = `${desc} ${sentences[1]}`;
  desc = desc.replace(/\s+/g, " ").trim();
  if (desc.length > 158) desc = `${desc.slice(0, 155).replace(/\s+\S*$/, "")}…`;
  return desc;
}

// Modifiers used to expand seed topics into long-tail search keywords.
const PREFIX_MODIFIERS = [
  "how to", "best", "top", "why", "what is", "guide to", "benefits of",
  "examples of", "types of", "tips for", "ways to", "learn",
];
const SUFFIX_MODIFIERS = [
  "guide", "tips", "examples", "checklist", "template", "tools", "strategies",
  "ideas", "best practices", "for beginners", "step by step", "explained",
  "benefits", "mistakes", "trends", "software", "framework", "vs alternatives",
];

/**
 * Generate a LARGE pool of tag & search-keyword ideas from the article — the
 * base extracted phrases plus long-tail modifier combinations. Returns up to
 * `limit` unique, Title-Cased suggestions with no external calls.
 */
export function deriveKeywordIdeas(
  input: { title: string; content: string; siteDomain?: string },
  limit = 120,
): string[] {
  const parsed = parseContent(input.content, input.siteDomain);
  const boost = new Set<string>();
  for (const w of `${input.title}`.toLowerCase().split(/\s+/)) {
    const c = w.replace(/[^a-z0-9]/g, "");
    if (c && !STOPWORDS.has(c) && c.length > 2) boost.add(c);
  }
  const ranked = rankPhrases(`${input.title}. ${parsed.text}`, boost);

  const out: string[] = [];
  const seen = new Set<string>();
  const add = (phrase: string) => {
    const p = phrase.trim().replace(/\s+/g, " ");
    const key = p.toLowerCase();
    if (!p || seen.has(key) || key.length < 3) return;
    seen.add(key);
    out.push(titleCase(p));
  };

  // 1. The raw extracted phrases (broadest coverage).
  for (const { phrase } of ranked) add(phrase);

  // 2. Long-tail combinations from the strongest seed topics.
  const seeds = ranked.slice(0, 12).map((r) => r.phrase);
  for (const seed of seeds) {
    for (const pre of PREFIX_MODIFIERS) add(`${pre} ${seed}`);
    for (const suf of SUFFIX_MODIFIERS) add(`${seed} ${suf}`);
    if (out.length > limit * 1.5) break;
  }

  // 3. Simple singular/plural variants of single-word seeds.
  for (const { phrase } of ranked.slice(0, 20)) {
    if (phrase.includes(" ")) continue;
    if (phrase.endsWith("s")) add(phrase.slice(0, -1));
    else add(`${phrase}s`);
  }

  return out.slice(0, limit);
}

/** Derive SEO metadata from a title + body with no external calls. */
export function deriveSeo(input: { title: string; content: string; siteDomain?: string }): DerivedSeo {
  const parsed = parseContent(input.content, input.siteDomain);
  const boost = new Set<string>();
  for (const w of `${input.title} ${parsed.headings.map((h) => h.text).join(" ")}`
    .toLowerCase()
    .split(/\s+/)) {
    const c = w.replace(/[^a-z0-9]/g, "");
    if (c && !STOPWORDS.has(c) && c.length > 2) boost.add(c);
  }

  const ranked = rankPhrases(`${input.title}. ${parsed.text}`, boost);
  const focusKeyphrase = ranked[0]?.phrase ?? "";

  // Secondary keyphrases: next distinct multi-word phrases.
  const secondaryKeyphrases: string[] = [];
  for (const { phrase } of ranked.slice(1)) {
    if (secondaryKeyphrases.length >= 3) break;
    if (phrase === focusKeyphrase) continue;
    if (phrase.split(" ").length < 2) continue;
    if (focusKeyphrase.includes(phrase) || phrase.includes(focusKeyphrase)) continue;
    secondaryKeyphrases.push(phrase);
  }

  // Tags: as many relevant, distinct terms as we can (title-cased), up to 12.
  const tags: string[] = [];
  const tagSeen = new Set<string>();
  for (const { phrase } of ranked) {
    if (tags.length >= 12) break;
    const words = phrase.split(" ");
    if (words.length > 3) continue;
    const key = phrase.toLowerCase();
    if (tagSeen.has(key)) continue;
    tagSeen.add(key);
    tags.push(titleCase(phrase));
  }

  return {
    focusKeyphrase,
    secondaryKeyphrases,
    tags,
    metaDescription: metaFrom(parsed.paragraphs.join(" ") || parsed.text, focusKeyphrase),
    slug: slugify(input.title || focusKeyphrase),
  };
}
