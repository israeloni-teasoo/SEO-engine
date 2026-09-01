import { parseContent } from "../analysis/parse";
import { generateVisionText, extractJson, type VisionImage } from "./provider";

export interface AltSuggestion {
  src: string;
  alt: string;
}

export interface AltTextResult {
  content: string;
  generated: AltSuggestion[];
}

const SYSTEM = `You write concise, descriptive, accessible image alt text for a blog post.
Rules:
- Describe what the image actually shows, factually and specifically.
- 5-16 words. No "image of" / "picture of" prefixes.
- Reflect the post topic where it fits, but never keyword-stuff.
- If you cannot see the image, infer a sensible description from the filename and post context.

Respond with ONLY JSON: { "alts": [ { "src": "<exact src>", "alt": "<alt text>" } ] }
Return one entry for every image src listed, in order.`;

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

export async function generateAltTextForContent(
  content: string,
  opts: { keyphrase?: string; title?: string; siteDomain?: string } = {},
): Promise<AltTextResult> {
  const parsed = parseContent(content, opts.siteDomain);
  const missing = parsed.images.filter((img) => !img.alt.trim());
  if (missing.length === 0) return { content, generated: [] };

  const lines = [
    `Post title: ${opts.title || "(untitled)"}`,
    opts.keyphrase ? `Focus keyphrase: ${opts.keyphrase}` : "",
    "",
    "Write alt text for these images (in order):",
    ...missing.map((img, i) =>
      isAbsoluteImage(img.src)
        ? `${i + 1}. src: ${img.src} (see attached image)`
        : `${i + 1}. src: ${img.src} (not fetchable; filename hint: "${filenameHint(img.src) || "unknown"}")`,
    ),
  ].filter(Boolean);

  const visionImages: VisionImage[] = missing
    .filter((img) => isAbsoluteImage(img.src))
    .map((img) => ({ url: img.src }));

  const text = await generateVisionText(SYSTEM, lines.join("\n"), visionImages);
  const parsedOut = extractJson<{ alts?: AltSuggestion[] }>(text);
  const alts = Array.isArray(parsedOut.alts) ? parsedOut.alts : [];

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
  const md = new RegExp(`!\\[\\s*\\]\\((${srcRe})(\\s+[^)]*)?\\)`, "g");
  let out = content.replace(md, (_m, s, tail = "") => `![${alt}](${s}${tail})`);
  const imgTag = new RegExp(`<img\\b[^>]*>`, "gi");
  out = out.replace(imgTag, (tag) => {
    if (!new RegExp(`src\\s*=\\s*["']${srcRe}["']`, "i").test(tag)) return tag;
    if (/\balt\s*=\s*["'][^"']*["']/i.test(tag)) {
      return tag.replace(/\balt\s*=\s*["']\s*["']/i, `alt="${escapeAttr(alt)}"`);
    }
    return tag.replace(/<img\b/i, `<img alt="${escapeAttr(alt)}"`);
  });
  return out;
}
