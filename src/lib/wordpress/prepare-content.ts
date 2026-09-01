import { uploadMedia, normalizeBaseUrl, type WordPressCredentials } from "./client";

export interface PreparedContent {
  html: string;
  featuredMediaId?: number;
  uploaded: number;
}

const extFromMime = (mime: string): string => {
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif",
  };
  return map[mime.toLowerCase()] || "png";
};

function slugName(alt: string, mime: string): string {
  const base = alt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${base || `image-${Date.now()}`}.${extFromMime(mime)}`;
}

function siteHost(creds: WordPressCredentials): string {
  try {
    return new URL(normalizeBaseUrl(creds.url)).host;
  } catch {
    return "";
  }
}

/**
 * Prepare editor HTML for WordPress: upload any inline data-URL images and any
 * externally-hosted images into the WP media library, rewrite their `src` to the
 * hosted URL, and return the first hosted image as the featured media.
 *
 * Best-effort: if an individual image can't be fetched/uploaded, it's left as-is
 * so a single bad image never blocks the whole publish.
 */
export async function prepareContentForWordPress(
  creds: WordPressCredentials,
  html: string,
): Promise<PreparedContent> {
  const host = siteHost(creds);
  const imgTagRe = /<img\b[^>]*>/gi;
  const tags = html.match(imgTagRe) ?? [];
  let out = html;
  let uploaded = 0;
  let featuredMediaId: number | undefined;
  let processed = 0;

  for (const tag of tags) {
    if (processed >= 20) break; // safety cap
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const alt = altMatch?.[1] ?? "";

    // Skip images already on the WP site or relative paths.
    if (!/^data:|^https?:\/\//i.test(src)) continue;
    if (/^https?:\/\//i.test(src)) {
      try {
        if (host && new URL(src).host === host) continue;
      } catch {
        continue;
      }
    }

    const fetched = await loadImage(src);
    if (!fetched) continue;

    processed++;
    try {
      const media = await uploadMedia(creds, {
        filename: slugName(alt, fetched.mime),
        contentType: fetched.mime,
        data: fetched.data,
      });
      // Replace this exact src occurrence with the hosted URL.
      out = out.replace(src, media.source_url);
      uploaded++;
      if (!featuredMediaId) featuredMediaId = media.id;
    } catch {
      // leave the original src in place
    }
  }

  return { html: out, featuredMediaId, uploaded };
}

/**
 * Resolve a chosen cover image into a WP media ID for use as the featured image.
 * Uploads data-URL/external covers; for an image already on the WP site, tries to
 * find its attachment by filename. Returns undefined if it can't be resolved.
 */
export async function resolveFeaturedMediaId(
  creds: WordPressCredentials,
  coverImage: string,
): Promise<number | undefined> {
  if (!coverImage) return undefined;
  const host = siteHost(creds);

  // Already hosted on the WP site: look it up by filename slug.
  if (/^https?:\/\//i.test(coverImage)) {
    try {
      if (host && new URL(coverImage).host === host) {
        const file = coverImage.split("/").pop()?.split("?")[0] ?? "";
        const slug = file.replace(/\.[a-z0-9]+$/i, "");
        if (slug) {
          const base = normalizeBaseUrl(creds.url);
          const res = await fetch(
            `${base}/wp-json/wp/v2/media?search=${encodeURIComponent(slug)}&per_page=5`,
            { headers: { Authorization: authHeaderFor(creds) } },
          );
          if (res.ok) {
            const items = (await res.json()) as { id: number; source_url: string }[];
            const exact = items.find((m) => m.source_url === coverImage) ?? items[0];
            if (exact) return exact.id;
          }
        }
        return undefined;
      }
    } catch {
      return undefined;
    }
  }

  // Data URL or external image: upload it.
  const loaded = await loadImage(coverImage);
  if (!loaded) return undefined;
  try {
    const media = await uploadMedia(creds, {
      filename: slugName("cover", loaded.mime),
      contentType: loaded.mime,
      data: loaded.data,
    });
    return media.id;
  } catch {
    return undefined;
  }
}

// Small auth header helper (avoids exporting the one in client.ts).
function authHeaderFor(creds: WordPressCredentials): string {
  const pass = creds.applicationPassword.replace(/\s+/g, "");
  return `Basic ${Buffer.from(`${creds.username}:${pass}`).toString("base64")}`;
}

async function loadImage(src: string): Promise<{ mime: string; data: Buffer } | null> {
  try {
    if (src.startsWith("data:")) {
      const m = src.match(/^data:([^;,]+)(;base64)?,(.*)$/i);
      if (!m) return null;
      const mime = m[1] || "image/png";
      if (!m[2]) return null; // only handle base64-encoded data URLs
      const data = Buffer.from(m[3], "base64");
      if (!data.byteLength || data.byteLength > 8_000_000) return null;
      return { mime, data };
    }
    const res = await fetch(src);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (!data.byteLength || data.byteLength > 8_000_000) return null;
    return { mime, data };
  } catch {
    return null;
  }
}
