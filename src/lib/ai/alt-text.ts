import Anthropic from "@anthropic-ai/sdk";
import { parseContent } from "../analysis/parse";
import { AI_MODEL, extractJson, getClient, textOf } from "./client";

export interface AltSuggestion {
  src: string;
  alt: string;
}

export interface AltTextResult {
  /** Content with alt attributes injected for images that were missing them. */
  content: string;
  generated: AltSuggestion[];
}

const SYSTEM = `You write concise, descriptive, accessible image alt text for a blog post.
Rules:
- Describe what the image actually shows, factually and specifically.
- 5-16 words. No "image of" / "picture of" prefixes. No trailing period needed.
- Where it fits naturally, reflect the post topic, but never keyword-stuff.
- If you cannot see the image, infer a sensible description from the filename and the
  post context, and keep it generic rather than inventing specific details.

Respond with ONLY JSON: { "alts": [ { "src": "<exact src>", "alt": "<alt text>" } ] }
Return one entry for every image src provided, in the same order.`;

const isAbsoluteImage = (src: string) => /^https?:\/\//i.test(src);

function filenameHint(src: string): string {
  try {
    const clean = src.split("?")[0].split("#")[0];
    const base = clean.substring(clean.lastIndexOf("/") + 1);
    return base.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
  } catch {
    return "";
  }
}

/**
 * Generate alt text for every image in `content` that is missing it, then return
 * the content with those alts injected. Images that already have alt text are
 * left untouched. Uses Claude vision for publicly-fetchable image URLs and falls
 * back to filename + post context for relative/local images.
 */
export async function generateAltTextForContent(
  content: string,
  opts: { keyphrase?: string; title?: string; siteDomain?: string } = {},
): Promise<AltTextResult> {
  const parsed = parseContent(content, opts.siteDomain);
  const missing = parsed.images.filter((img) => !img.alt.trim());
  if (missing.length === 0) return { content, generated: [] };

  const client = getClient();

  // Build a single multimodal message: an image block for fetchable URLs, a text
  // note (filename + context) for the rest.
  const blocks: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: [
        `Post title: ${opts.title || "(untitled)"}`,
        opts.keyphrase ? `Focus keyphrase: ${opts.keyphrase}` : "",
        "",
        "Write alt text for these images:",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  missing.forEach((img, i) => {
    blocks.push({ type: "text", text: `\nImage ${i + 1} — src: ${img.src}` });
    if (isAbsoluteImage(img.src)) {
      blocks.push({ type: "image", source: { type: "url", url: img.src } });
    } else {
      const hint = filenameHint(img.src);
      blocks.push({
        type: "text",
        text: `(not fetchable; filename hint: "${hint || "unknown"}")`,
      });
    }
  });

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: blocks }],
  });

  const parsedOut = extractJson<{ alts?: AltSuggestion[] }>(textOf(response.content));
  const alts = Array.isArray(parsedOut.alts) ? parsedOut.alts : [];

  // Map by src, falling back to positional order if the model dropped a src.
  const bySrc = new Map<string, string>();
  alts.forEach((a, i) => {
    const src = a.src || missing[i]?.src;
    if (src && a.alt) bySrc.set(src, a.alt.trim());
  });

  const generated: AltSuggestion[] = [];
  let updated = content;
  for (const img of missing) {
    const alt = bySrc.get(img.src);
    if (!alt) continue;
    updated = injectAlt(updated, img.src, alt);
    generated.push({ src: img.src, alt });
  }

  return { content: updated, generated };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeAttr = (s: string) => s.replace(/"/g, "&quot;");

/** Add/replace the alt attribute for a specific image in Markdown or HTML. */
export function injectAlt(content: string, src: string, alt: string): string {
  const srcRe = escapeRe(src);

  // Markdown: ![](src) or ![   ](src) -> ![alt](src)
  const md = new RegExp(`!\\[\\s*\\]\\((${srcRe})(\\s+[^)]*)?\\)`, "g");
  let out = content.replace(md, (_m, s, tail = "") => `![${alt}](${s}${tail})`);

  // HTML: <img ... src="src" ...> — add alt if absent, or fill an empty alt.
  const imgTag = new RegExp(`<img\\b[^>]*>`, "gi");
  out = out.replace(imgTag, (tag) => {
    if (!new RegExp(`src\\s*=\\s*["']${srcRe}["']`, "i").test(tag)) return tag;
    if (/\balt\s*=\s*["'][^"']*["']/i.test(tag)) {
      // Replace only when the existing alt is empty.
      return tag.replace(
        /\balt\s*=\s*["']\s*["']/i,
        `alt="${escapeAttr(alt)}"`,
      );
    }
    return tag.replace(/<img\b/i, `<img alt="${escapeAttr(alt)}"`);
  });

  return out;
}
