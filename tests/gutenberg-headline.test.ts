import { describe, it, expect } from "vitest";
import { htmlToGutenberg } from "../src/lib/wordpress/gutenberg";
import { analyzeHeadline, headlineGaps } from "../src/lib/analysis/headline";

describe("htmlToGutenberg", () => {
  it("wraps headings, paragraphs, and lists in block comments", () => {
    const out = htmlToGutenberg("<h2>Why ESG</h2><p>Pension funds matter.</p><ul><li>One</li><li>Two</li></ul>");
    expect(out).toContain("<!-- wp:heading -->");
    expect(out).toContain("<!-- wp:paragraph -->");
    expect(out).toContain("<!-- wp:list -->");
    expect(out).toContain("<!-- wp:list-item -->");
  });

  it("adds a level attribute for h3", () => {
    expect(htmlToGutenberg("<h3>Sub</h3>")).toContain('<!-- wp:heading {"level":3} -->');
  });

  it("emits an image block", () => {
    const out = htmlToGutenberg('<p><img src="/x.png" alt="A chart"></p>');
    // The img inside a <p> stays a paragraph; a standalone figure becomes an image block.
    const fig = htmlToGutenberg('<figure><img src="/x.png" alt="A chart"></figure>');
    expect(fig).toContain("<!-- wp:image -->");
    expect(out).toContain("<!-- wp:paragraph -->");
  });
});

describe("analyzeHeadline", () => {
  it("detects power and emotional words and sentiment", () => {
    const h = analyzeHeadline("Proven, Surprising ESG Secrets That Boost Trust");
    expect(h.powerCount).toBeGreaterThanOrEqual(1);
    expect(h.emotionalPct).toBeGreaterThan(0);
    expect(h.sentiment).toBe("positive");
  });

  it("flags a flat, neutral headline", () => {
    const gaps = headlineGaps(analyzeHeadline("A report about pension fund administration"));
    expect(gaps.length).toBeGreaterThan(0);
  });
});
