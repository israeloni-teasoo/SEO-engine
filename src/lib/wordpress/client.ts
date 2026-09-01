// Minimal WordPress REST API client using Application Passwords (HTTP Basic auth).
// Docs: https://developer.wordpress.org/rest-api/using-the-rest-api/authentication/
// Create an Application Password under WP Admin -> Users -> Profile -> Application Passwords.

export interface WordPressCredentials {
  /** Base site URL, e.g. https://blog.example.com */
  url: string;
  username: string;
  /** Application Password (spaces are allowed and stripped automatically). */
  applicationPassword: string;
}

/**
 * Neutral SEO meta keys written by the SEO Engine companion plugin
 * (wordpress-plugin/seo-engine-bridge.php). The bridge maps these onto whichever
 * SEO plugin is active — Yoast, Rank Math, or All in One SEO.
 */
export interface SeoMeta {
  seo_engine_title?: string;
  seo_engine_description?: string;
  seo_engine_focus_keyphrase?: string;
  /** Comma-separated secondary keyphrases. */
  seo_engine_secondary_keyphrases?: string;
}

export interface CreatePostInput {
  title: string;
  /** Post body (HTML). Markdown should be converted before calling. */
  content: string;
  status?: "draft" | "publish" | "pending" | "future";
  slug?: string;
  excerpt?: string;
  /** ISO date for scheduled ("future") posts. */
  date?: string;
  /** Category term IDs. */
  categories?: number[];
  /** Tag term IDs. */
  tags?: number[];
  /** SEO plugin meta (via the companion bridge plugin). */
  meta?: SeoMeta;
  /** Featured image media ID. */
  featured_media?: number;
}

export interface WordPressTerm {
  id: number;
  name: string;
  slug: string;
}

export interface WordPressUser {
  id: number;
  name: string;
  slug: string;
}

export interface CreatedPost {
  id: number;
  link: string;
  status: string;
}

export class WordPressError extends Error {
  status: number;
  /** Parsed `data` object from the WP error body, when present. */
  data?: Record<string, unknown>;
  code?: string;
  constructor(message: string, status: number, extra?: { data?: Record<string, unknown>; code?: string }) {
    super(message);
    this.name = "WordPressError";
    this.status = status;
    this.data = extra?.data;
    this.code = extra?.code;
  }
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function authHeader(creds: WordPressCredentials): string {
  const pass = creds.applicationPassword.replace(/\s+/g, "");
  const token = Buffer.from(`${creds.username}:${pass}`).toString("base64");
  return `Basic ${token}`;
}

/**
 * Low-level call against a REST namespace. `path` is relative to `/wp-json`,
 * e.g. "/wp/v2/posts" or "/seo-engine/v1/status".
 */
async function wpFetch<T>(
  creds: WordPressCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = normalizeBaseUrl(creds.url);
  const endpoint = `${base}/wp-json${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  // Retrying a POST/PUT risks duplicate writes, so only retry safe GETs.
  const maxAttempts = method === "GET" ? 3 : 1;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(endpoint, {
        ...init,
        headers: {
          Authorization: authHeader(creds),
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch (e) {
      lastErr = new WordPressError(
        `Could not reach ${base}. Check the site URL and that the REST API is enabled. (${(e as Error).message})`,
        0,
      );
      if (attempt < maxAttempts) { await sleep(300 * attempt); continue; }
      throw lastErr;
    }

    const bodyText = await res.text();
    if (!res.ok) {
      // Retry transient server errors for GETs.
      if (res.status >= 500 && attempt < maxAttempts) { await sleep(300 * attempt); continue; }
      let message = `WordPress responded with ${res.status}.`;
      let data: Record<string, unknown> | undefined;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(bodyText) as { message?: string; code?: string; data?: Record<string, unknown> };
        if (parsed.message) message = parsed.message;
        code = parsed.code;
        data = parsed.data;
        if (res.status === 401) {
          message = `Authentication failed. Check the username and Application Password. (${parsed.message ?? parsed.code ?? ""})`;
        }
      } catch {
        /* keep default message */
      }
      throw new WordPressError(message, res.status, { data, code });
    }

    return (bodyText ? JSON.parse(bodyText) : {}) as T;
  }
  throw lastErr as Error;
}

/** Call the core `/wp/v2` namespace. `path` starts with "/", e.g. "/posts". */
function request<T>(
  creds: WordPressCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  return wpFetch<T>(creds, `/wp/v2${path}`, init);
}

/** Verify credentials by fetching the authenticated user. */
export async function testConnection(
  creds: WordPressCredentials,
): Promise<WordPressUser> {
  return request<WordPressUser>(creds, "/users/me?context=edit");
}

function postPayload(input: CreatePostInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    title: input.title,
    content: input.content,
    status: input.status ?? "draft",
  };
  if (input.slug) payload.slug = input.slug;
  if (input.excerpt) payload.excerpt = input.excerpt;
  if (input.date) payload.date = input.date;
  if (input.categories?.length) payload.categories = input.categories;
  if (input.tags?.length) payload.tags = input.tags;
  if (input.meta && Object.keys(input.meta).length) payload.meta = input.meta;
  if (input.featured_media) payload.featured_media = input.featured_media;
  return payload;
}

/** Create (draft, publish, or schedule) a post. */
export async function createPost(
  creds: WordPressCredentials,
  input: CreatePostInput,
): Promise<CreatedPost> {
  return request<CreatedPost>(creds, "/posts", {
    method: "POST",
    body: JSON.stringify(postPayload(input)),
  });
}

/** Update an existing post in place (avoids creating a duplicate). */
export async function updatePost(
  creds: WordPressCredentials,
  postId: number,
  input: CreatePostInput,
): Promise<CreatedPost> {
  return request<CreatedPost>(creds, `/posts/${postId}`, {
    method: "POST",
    body: JSON.stringify(postPayload(input)),
  });
}

/** Fetch a post (used to confirm a publish round-trip). */
export async function getPost(
  creds: WordPressCredentials,
  postId: number,
): Promise<CreatedPost | null> {
  try {
    return await request<CreatedPost>(creds, `/posts/${postId}?context=edit`);
  } catch {
    return null;
  }
}

type Taxonomy = "categories" | "tags";

/**
 * Resolve an array of term *names* to WordPress term IDs for a taxonomy,
 * creating any that don't already exist. Returns the resolved IDs.
 */
export async function resolveTerms(
  creds: WordPressCredentials,
  taxonomy: Taxonomy,
  names: string[],
): Promise<number[]> {
  const cleaned = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  const resolveOne = async (name: string): Promise<number | null> => {
    try {
      const found = await request<WordPressTerm[]>(
        creds,
        `/${taxonomy}?search=${encodeURIComponent(name)}&per_page=100`,
      );
      const match = found.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (match) return match.id;

      // Create it; tolerate a race where it already exists (term_exists).
      try {
        const created = await request<WordPressTerm>(creds, `/${taxonomy}`, {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        return created.id;
      } catch (e) {
        if (e instanceof WordPressError && (e.code === "term_exists" || e.status === 400)) {
          const existingId = e.data?.term_id;
          if (typeof existingId === "number") return existingId;
          // Fall back to another exact-match search.
          const retry = await request<WordPressTerm[]>(
            creds,
            `/${taxonomy}?search=${encodeURIComponent(name)}&per_page=100`,
          );
          const m = retry.find((t) => t.name.toLowerCase() === name.toLowerCase());
          if (m) return m.id;
        }
        return null; // don't let one bad tag fail the whole publish
      }
    } catch {
      return null;
    }
  };

  // Resolve in small parallel batches to keep it fast without hammering the API.
  const ids: number[] = [];
  const batchSize = 5;
  for (let i = 0; i < cleaned.length; i += batchSize) {
    const batch = cleaned.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(resolveOne));
    for (const id of results) if (id !== null) ids.push(id);
  }
  return ids;
}

export interface UploadedMedia {
  id: number;
  source_url: string;
}

/** Upload an image to the WordPress media library. Returns the hosted URL. */
export async function uploadMedia(
  creds: WordPressCredentials,
  file: { filename: string; contentType: string; data: Buffer | Uint8Array },
): Promise<UploadedMedia> {
  const base = normalizeBaseUrl(creds.url);
  const endpoint = `${base}/wp-json/wp/v2/media`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader(creds),
        "Content-Type": file.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.filename.replace(/"/g, "")}"`,
      },
      body: file.data as BodyInit,
    });
  } catch (e) {
    throw new WordPressError(`Could not reach ${base} to upload media. (${(e as Error).message})`, 0);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = `Media upload failed (${res.status}).`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* keep default */
    }
    throw new WordPressError(message, res.status);
  }
  return JSON.parse(text) as UploadedMedia;
}

/** Does the SEO Engine companion bridge plugin appear to be installed? */
export async function bridgeStatus(
  creds: WordPressCredentials,
): Promise<{ installed: boolean; seoPlugin: string | null }> {
  try {
    const res = await wpFetch<{ ok: boolean; seo_plugin: string | null }>(
      creds,
      "/seo-engine/v1/status",
    );
    return { installed: Boolean(res.ok), seoPlugin: res.seo_plugin ?? null };
  } catch {
    return { installed: false, seoPlugin: null };
  }
}
