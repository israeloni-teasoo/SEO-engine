// IndexNow: instantly notify participating search engines (Bing, Yandex, Naver,
// Seznam, Yep — and Bing powers ChatGPT search) that a URL was added or updated.
// Google does NOT support IndexNow; for Google, rely on XML sitemaps + Search
// Console (your SEO plugin already generates the sitemap). See docs/SETUP.md.
//
// Protocol: https://www.indexnow.org/documentation

export interface IndexNowResult {
  ok: boolean;
  status: number;
  message: string;
}

/**
 * Submit one or more URLs to IndexNow. All URLs must belong to `host`, and a
 * key file `<key>.txt` containing exactly `key` must be reachable at the host
 * root (e.g. https://host/<key>.txt) so the search engine can verify ownership.
 */
export async function submitUrls(
  host: string,
  key: string,
  urls: string[],
  keyLocation?: string,
): Promise<IndexNowResult> {
  const urlList = urls.filter(Boolean);
  if (!host || !key) {
    return { ok: false, status: 0, message: "Missing IndexNow host or key." };
  }
  if (urlList.length === 0) {
    return { ok: false, status: 0, message: "No URLs to submit." };
  }

  const body: Record<string, unknown> = { host, key, urlList };
  if (keyLocation) body.keyLocation = keyLocation;

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    // 200 = accepted, 202 = accepted pending key validation.
    const ok = res.status === 200 || res.status === 202;
    return {
      ok,
      status: res.status,
      message: ok
        ? "Submitted to IndexNow (Bing, Yandex, and others)."
        : `IndexNow responded ${res.status}. Check that ${host}/${key}.txt is reachable.`,
    };
  } catch (e) {
    return { ok: false, status: 0, message: (e as Error).message };
  }
}

/** Derive the bare host from a full URL. */
export function hostFromUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}
