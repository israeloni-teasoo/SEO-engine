import { describe, it, expect } from "vitest";
import { analyze } from "../src/lib/analysis/index";
import { estimateTitleWidthPx } from "../src/lib/analysis/checks/seo";

const goodPost = {
  title: "Remote Team Productivity: A Practical Guide",
  focusKeyphrase: "remote team productivity",
  slug: "remote-team-productivity-guide",
  metaDescription:
    "Boost remote team productivity with practical routines, the right tools, and async habits your team will actually stick to today.",
  content: `## Why remote team productivity matters

Remote team productivity depends on clear systems. However, many teams struggle at first. For example, they keep old meeting habits.

## Build async habits

Write decisions down. Use a shared doc. Therefore, everyone stays aligned across time zones.

## Measure outcomes

Track shipped work. Review it weekly. In short, focus on results, not hours.`,
};

describe("analyze", () => {
  it("produces scores and a full check set", () => {
    const r = analyze(goodPost);
    expect(r.overallScore).toBeGreaterThanOrEqual(0);
    expect(r.overallScore).toBeLessThanOrEqual(100);
    expect(r.checks.length).toBeGreaterThan(10);
    expect(r.checks.some((c) => c.category === "seo")).toBe(true);
    expect(r.checks.some((c) => c.category === "readability")).toBe(true);
  });

  it("passes keyphrase placement checks when the keyphrase is present", () => {
    const r = analyze(goodPost);
    const inTitle = r.checks.find((c) => c.id === "keyphrase-in-title");
    const inIntro = r.checks.find((c) => c.id === "keyphrase-in-intro");
    expect(inTitle?.status).toBe("good");
    expect(inIntro?.status).toBe("good");
  });

  it("flags a missing focus keyphrase", () => {
    const r = analyze({ ...goodPost, focusKeyphrase: "" });
    expect(r.checks.find((c) => c.id === "keyphrase-set")?.status).toBe("bad");
  });

  it("flags thin content", () => {
    const r = analyze({
      title: "Short",
      content: "Too short to rank.",
      focusKeyphrase: "short",
    });
    expect(r.checks.find((c) => c.id === "content-length")?.status).toBe("bad");
  });

  it("computes keyphrase density from occurrences", () => {
    const r = analyze(goodPost);
    expect(r.metrics.keyphraseCount).toBeGreaterThanOrEqual(1);
    expect(r.metrics.keyphraseDensity).not.toBeNull();
  });

  it("parses HTML input equivalently to markdown", () => {
    const html = analyze({
      ...goodPost,
      content:
        "<h2>Why remote team productivity matters</h2><p>Remote team productivity depends on clear systems.</p>",
    });
    expect(html.metrics.wordCount).toBeGreaterThan(0);
    expect(html.checks.length).toBeGreaterThan(10);
  });
});

describe("estimateTitleWidthPx", () => {
  it("scales with length and returns 0 for empty", () => {
    expect(estimateTitleWidthPx("")).toBe(0);
    expect(estimateTitleWidthPx("A short title")).toBeGreaterThan(0);
    expect(
      estimateTitleWidthPx(
        "How Modern Companies Grow Massive Audiences Around Amazing Marketing Programs",
      ),
    ).toBeGreaterThan(580);
  });
});
