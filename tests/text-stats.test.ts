import { describe, it, expect } from "vitest";
import {
  splitSentences,
  tokenizeWords,
  countSyllables,
  fleschReadingEase,
  hasTransitionWord,
  isPassiveSentence,
  countPhraseOccurrences,
} from "../src/lib/analysis/text-stats";

describe("splitSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    const s = splitSentences("Hello world. This is a test! Is it? Yes.");
    expect(s).toHaveLength(4);
  });
  it("returns empty for blank input", () => {
    expect(splitSentences("   ")).toHaveLength(0);
  });
});

describe("tokenizeWords", () => {
  it("keeps internal apostrophes and hyphens", () => {
    expect(tokenizeWords("It's a well-known fact")).toEqual([
      "it's",
      "a",
      "well-known",
      "fact",
    ]);
  });
});

describe("countSyllables", () => {
  it("counts common words reasonably", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("beautiful")).toBeGreaterThanOrEqual(3);
  });
});

describe("fleschReadingEase", () => {
  it("scores simple text high and clamps to range", () => {
    const score = fleschReadingEase({
      wordCount: 10,
      sentenceCount: 2,
      syllableCount: 12,
    });
    expect(score).toBeGreaterThan(60);
    expect(score).toBeLessThanOrEqual(100);
  });
  it("returns 0 with no sentences", () => {
    expect(fleschReadingEase({ wordCount: 0, sentenceCount: 0, syllableCount: 0 })).toBe(0);
  });
});

describe("hasTransitionWord", () => {
  it("detects leading transition words", () => {
    expect(hasTransitionWord("However, this is fine.")).toBe(true);
    expect(hasTransitionWord("For example, cats sleep.")).toBe(true);
  });
  it("returns false when none present", () => {
    expect(hasTransitionWord("Cats sleep a lot.")).toBe(false);
  });
});

describe("isPassiveSentence", () => {
  it("flags be-verb + past participle", () => {
    expect(isPassiveSentence("The ball was thrown by the boy.")).toBe(true);
    expect(isPassiveSentence("Mistakes were made.")).toBe(true);
    expect(isPassiveSentence("The report was written overnight.")).toBe(true);
  });
  it("does not flag active voice", () => {
    expect(isPassiveSentence("The boy throws the ball.")).toBe(false);
  });
});

describe("countPhraseOccurrences", () => {
  it("counts word-boundary matches only", () => {
    expect(countPhraseOccurrences("SEO tips and more SEO tips", "seo tips")).toBe(2);
    expect(countPhraseOccurrences("seonar seoness", "seo")).toBe(0);
  });
});
