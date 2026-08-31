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
  constructor(message: string, status: number) {
    super(message);
    this.name = "WordPressError";
    this.status = status;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

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
    throw new WordPressError(
      `Could not reach ${base}. Check the site URL and that the REST API is enabled. (${(e as Error).message})`,
      0,
    );
  }

  const bodyText = await res.text();
  if (!res.ok) {
    let message = `WordPress responded with ${res.status}.`;
    try {
      const parsed = JSON.parse(bodyText) as { message?: string; code?: string };
      if (parsed.message) message = parsed.message;
      if (res.status === 401) {
        message = `Authentication failed. Check the username and Application Password. (${parsed.message ?? parsed.code ?? ""})`;
      }
    } catch {
      /* keep default message */
    }
    throw new WordPressError(message, res.status);
  }

  return (bodyText ? JSON.parse(bodyText) : {}) as T;
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

/** Create (draft, publish, or schedule) a post. */
export async function createPost(
  creds: WordPressCredentials,
  input: CreatePostInput,
): Promise<CreatedPost> {
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

  return request<CreatedPost>(creds, "/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
  const ids: number[] = [];

  for (const name of cleaned) {
    const found = await request<WordPressTerm[]>(
      creds,
      `/${taxonomy}?search=${encodeURIComponent(name)}&per_page=20`,
    );
    const match = found.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      ids.push(match.id);
      continue;
    }
    // Create the term if it doesn't exist yet.
    const created = await request<WordPressTerm>(creds, `/${taxonomy}`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    ids.push(created.id);
  }
  return ids;
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
