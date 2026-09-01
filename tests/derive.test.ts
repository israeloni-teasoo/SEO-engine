import { describe, it, expect } from "vitest";
import { deriveSeo, deriveKeywordIdeas, slugify } from "../src/lib/seo/derive";

describe("slugify", () => {
  it("makes a clean kebab slug", () => {
    expect(slugify("Remote Team Productivity: A Guide!")).toBe("remote-team-productivity-a-guide");
  });
});

describe("deriveSeo (rule-based, no AI)", () => {
  const article = {
    title: "Remote Team Productivity Guide",
    content: `<h2>Remote team productivity</h2>
      <p>Remote team productivity depends on clear systems and async communication.
      Distributed teams that write decisions down move faster. Async communication
      reduces meetings. Remote work rewards clear writing and focused deep work.</p>
      <h2>Async communication habits</h2>
      <p>Async communication means writing decisions down. Distributed teams thrive
      when they document processes and reduce synchronous meetings.</p>`,
  };

  it("derives a focus keyphrase, tags, meta and slug", () => {
    const seo = deriveSeo(article);
    expect(seo.focusKeyphrase.length).toBeGreaterThan(0);
    expect(seo.tags.length).toBeGreaterThanOrEqual(4);
    expect(seo.metaDescription.length).toBeGreaterThan(0);
    expect(seo.metaDescription.length).toBeLessThanOrEqual(160);
    expect(seo.slug).toBe("remote-team-productivity-guide");
  });

  it("surfaces topical phrases from the content", () => {
    const seo = deriveSeo(article);
    const all = [seo.focusKeyphrase, ...seo.secondaryKeyphrases, ...seo.tags]
      .join(" ")
      .toLowerCase();
    // Should reflect the actual subject matter.
    expect(all).toMatch(/remote|async|distributed|productivity|communication/);
  });

  it("returns empty-ish result for empty content without throwing", () => {
    const seo = deriveSeo({ title: "", content: "" });
    expect(seo.tags).toEqual([]);
    expect(seo.focusKeyphrase).toBe("");
  });
});

describe("deriveKeywordIdeas", () => {
  const article = {
    title: "Remote Team Productivity Guide",
    content: `<h2>Remote team productivity</h2>
      <p>Remote team productivity depends on clear systems and async communication.
      Distributed teams that document decisions move faster and reduce meetings.
      Remote work rewards focused deep work and written communication.</p>`,
  };

  it("produces a large pool of unique ideas with long-tail variants", () => {
    const ideas = deriveKeywordIdeas(article, 120);
    expect(ideas.length).toBeGreaterThan(30);
    // unique
    expect(new Set(ideas.map((i) => i.toLowerCase())).size).toBe(ideas.length);
    // includes modifier-based long-tail phrases
    expect(ideas.some((i) => /how to|guide|tips|best/i.test(i))).toBe(true);
  });
});
