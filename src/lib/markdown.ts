import { marked } from "marked";

/** Heuristic: does this string already look like HTML block markup? */
export function looksLikeHtml(content: string): boolean {
  return /<(p|div|h[1-6]|ul|ol|li|img|a|section|article|table|blockquote|br)\b/i.test(
    content,
  );
}

/** Convert Markdown to HTML for WordPress; pass HTML through unchanged. */
export function toHtml(content: string): string {
  if (looksLikeHtml(content)) return content;
  const out = marked.parse(content, { async: false });
  return typeof out === "string" ? out : content;
}
