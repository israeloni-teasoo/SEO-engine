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

export interface CreatePostInput {
  title: string;
  /** Post body (HTML). Markdown should be converted before calling. */
  content: string;
  status?: "draft" | "publish" | "pending" | "future";
  slug?: string;
  excerpt?: string;
  /** ISO date for scheduled ("future") posts. */
  date?: string;
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

async function request<T>(
  creds: WordPressCredentials,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = normalizeBaseUrl(creds.url);
  const endpoint = `${base}/wp-json/wp/v2${path}`;
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

  return request<CreatedPost>(creds, "/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
