"use client";

// Robust client fetch helpers. Servers can return non-JSON bodies (a serverless
// timeout, a proxy/HTML error page, an empty body). Parsing those with res.json()
// throws "Unexpected token ..." and hides the real problem, so every call goes
// through here: it reads text, tries JSON, and otherwise builds a friendly error.

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

function friendlyError(status: number, text: string): string {
  if (status === 504 || status === 408 || /timeout|timed out|FUNCTION_INVOCATION_TIMEOUT/i.test(text)) {
    return "The request timed out on the server. Optimizing a very long article can exceed the hosting time limit — try again, shorten the article, or split the work (e.g. use “Review fixes”).";
  }
  if (status === 413) return "That request was too large. Try a shorter article or a smaller image.";
  if (status === 502 || status === 503) return `The service is temporarily unavailable (${status}). Please try again in a moment.`;
  // Strip any HTML and show a short snippet of whatever the server sent.
  const snippet = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return snippet ? `Server error (${status}): ${snippet.slice(0, 180)}` : `Request failed (${status}).`;
}

/** Parse any Response safely into { ok, status, data } with a guaranteed `error` on failure. */
export async function parseResponse<T = any>(res: Response): Promise<ApiResult<T>> {
  let text = "";
  try {
    text = await res.text();
  } catch {
    /* body already consumed or network cut */
  }
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: friendlyError(res.status, text) };
    }
  } else if (!res.ok) {
    data = { error: friendlyError(res.status, "") };
  }
  if (!res.ok && (data == null || typeof data !== "object" || !("error" in data))) {
    data = { error: friendlyError(res.status, text) };
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

/** POST a JSON body and parse the response safely. Network failures resolve, not throw. */
export async function postJson<T = any>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, status: 0, data: { error: `Could not reach the server: ${(e as Error).message}` } as T };
  }
}

/** POST FormData (file upload) and parse the response safely. */
export async function postForm<T = any>(url: string, form: FormData): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", body: form });
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, status: 0, data: { error: `Upload failed: ${(e as Error).message}` } as T };
  }
}

/** GET JSON and parse safely. */
export async function getJson<T = any>(url: string): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url);
    return parseResponse<T>(res);
  } catch (e) {
    return { ok: false, status: 0, data: { error: (e as Error).message } as T };
  }
}
