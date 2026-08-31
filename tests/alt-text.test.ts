import { describe, it, expect } from "vitest";
import { injectAlt } from "../src/lib/ai/alt-text";

describe("injectAlt", () => {
  it("fills an empty markdown alt", () => {
    expect(injectAlt("![](/img/cat.png)", "/img/cat.png", "A sleeping cat")).toBe(
      "![A sleeping cat](/img/cat.png)",
    );
  });

  it("adds alt to an HTML img with no alt attribute", () => {
    const out = injectAlt(
      '<img src="/img/cat.png" width="400">',
      "/img/cat.png",
      "A sleeping cat",
    );
    expect(out).toContain('alt="A sleeping cat"');
    expect(out).toContain('src="/img/cat.png"');
  });

  it("fills an empty HTML alt but leaves a non-empty one alone", () => {
    expect(injectAlt('<img alt="" src="/a.png">', "/a.png", "New alt")).toContain(
      'alt="New alt"',
    );
    const kept = injectAlt('<img alt="Existing" src="/a.png">', "/a.png", "New alt");
    expect(kept).toContain('alt="Existing"');
    expect(kept).not.toContain("New alt");
  });

  it("only touches the image with the matching src", () => {
    const html = '<img src="/a.png"><img src="/b.png">';
    const out = injectAlt(html, "/b.png", "Bee");
    expect(out).toBe('<img src="/a.png"><img alt="Bee" src="/b.png">');
  });

  it("escapes quotes in generated alt text", () => {
    const out = injectAlt('<img src="/a.png">', "/a.png", 'The "big" chart');
    expect(out).toContain("&quot;big&quot;");
  });
});
