import { parse as parseHtml, HTMLElement } from "node-html-parser";
import { marked } from "marked";
import type { ParsedContent } from "./types";
import { splitSentences, tokenizeWords } from "./text-stats";

/**
 * Convert incoming content (Markdown *or* HTML) into structured facts.
 *
 * Everything is routed through Markdown -> HTML first so that both input styles
 * produce the same DOM. Raw HTML passes through `marked` essentially untouched.
 */
export function parseContent(rawContent: string, siteDomain?: string): ParsedContent {
  const rawHtml = markdownToHtml(rawContent);
  // Insert a separator after each block element so extracted text doesn't run
  // words together across blocks (e.g. a heading directly before a paragraph).
  const html = rawHtml.replace(
    /<\/(h[1-6]|p|li|blockquote|div|section|article|ul|ol|tr|td|th|figcaption)>/gi,
    "$& \n",
  );
  const root = parseHtml(html, {
    lowerCaseTagName: true,
    comment: false,
    blockTextElements: { script: false, style: false, pre: true, code: true },
  });

  // Drop code/script/style so their contents don't pollute the prose stats.
  root.querySelectorAll("script,style,noscript").forEach((n) => n.remove());

  const headings: ParsedContent["headings"] = [];
  root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((h) => {
    const level = Number(h.tagName.slice(1));
    const text = normalizeWhitespace(h.text);
    if (text) headings.push({ level, text });
  });

  const paragraphBlocks = collectParagraphBlocks(root);
  const paragraphs = paragraphBlocks
    .map((p) => normalizeWhitespace(p))
    .filter(Boolean);

  const images: ParsedContent["images"] = root
    .querySelectorAll("img")
    .map((img) => ({
      src: img.getAttribute("src") ?? "",
      alt: (img.getAttribute("alt") ?? "").trim(),
    }));

  const links: ParsedContent["links"] = root
    .querySelectorAll("a")
    .map((a) => a.getAttribute("href") ?? "")
    .filter((href) => href && !href.startsWith("javascript:"))
    .map((href) => ({ href, internal: isInternalLink(href, siteDomain) }));

  const text = normalizeWhitespace(root.text);
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const firstParagraph = paragraphs[0] ?? text;

  return {
    text,
    words,
    sentences,
    paragraphs,
    headings,
    images,
    links,
    firstParagraph,
    wordCount: words.length,
  };
}

function markdownToHtml(content: string): string {
  // marked is synchronous by default (async option is off).
  const out = marked.parse(content, { async: false });
  return typeof out === "string" ? out : content;
}

/**
 * Gather block-level prose as discrete "paragraph" strings so per-paragraph
 * checks (length, subheading spacing) work for both <p> tags and loose text.
 */
function collectParagraphBlocks(root: HTMLElement): string[] {
  const blocks: string[] = [];
  const nodes = root.querySelectorAll("p,li,blockquote");
  if (nodes.length > 0) {
    for (const n of nodes) blocks.push(n.text);
    return blocks;
  }
  // Fallback: no block tags — split on blank lines.
  return root.text.split(/\n{2,}/);
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isInternalLink(href: string, siteDomain?: string): boolean {
  const h = href.trim();
  if (h.startsWith("#")) return false; // in-page anchor, not a real link target
  if (/^https?:\/\//i.test(h)) {
    if (!siteDomain) return false;
    try {
      const host = new URL(h).hostname.replace(/^www\./, "");
      return host === siteDomain.replace(/^www\./, "");
    } catch {
      return false;
    }
  }
  // Relative or root-relative links are internal by definition.
  return h.startsWith("/") || /^[a-z0-9._-]+\//i.test(h) || !h.includes(":");
}
