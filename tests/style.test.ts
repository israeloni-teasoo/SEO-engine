import { describe, it, expect } from "vitest";
import { sanitizeAiText } from "../src/lib/ai/style";

describe("sanitizeAiText", () => {
  it("replaces spaced em dashes with a comma", () => {
    expect(sanitizeAiText("It works — really well.")).toBe("It works, really well.");
  });

  it("replaces unspaced em dashes", () => {
    expect(sanitizeAiText("fast—reliable code")).toBe("fast, reliable code");
  });

  it("handles en dashes used as separators", () => {
    expect(sanitizeAiText("clear – and simple")).toBe("clear, and simple");
  });

  it("keeps numeric en-dash ranges intact", () => {
    expect(sanitizeAiText("From 2020–2024 growth was steady.")).toContain("2020–2024");
  });

  it("does not mangle normal text or hyphens", () => {
    const s = "A well-known, plain sentence.";
    expect(sanitizeAiText(s)).toBe(s);
  });

  it("leaves HTML tags untouched", () => {
    expect(sanitizeAiText("<p>fast—clean</p>")).toBe("<p>fast, clean</p>");
  });
});
