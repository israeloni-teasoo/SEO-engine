"use client";

import { useEffect, useState } from "react";
import { postJson } from "./api";
import PasswordInput from "./PasswordInput";

export interface PublishDraft {
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string;
  slug: string;
  tags: string;
  categories: string;
}

const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

interface LiStatus { configured: boolean; connected: boolean; name: string | null; orgId: string | null; canPostOrg: boolean; }

export default function PublishModal({
  draft, articleId, wpPostId, wpLink, coverImage, coverMediaId, multiUser, onClose, onDone,
}: {
  draft: PublishDraft;
  articleId: string | null;
  wpPostId: number | null;
  wpLink: string | null;
  coverImage: string;
  coverMediaId: number | null;
  multiUser: boolean;
  onClose: () => void;
  onDone: (msg: string, status?: string, wpPostId?: number) => void;
}) {
  // Destinations
  const [toWp, setToWp] = useState(true);
  const [toLi, setToLi] = useState(false);
  const [tab, setTab] = useState<"wordpress" | "linkedin">("wordpress");

  // WordPress
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [status, setStatus] = useState<"draft" | "publish">("publish");
  const [pingIndexNow, setPingIndexNow] = useState(true);
  const [tested, setTested] = useState<string | null>(null);

  // LinkedIn
  const [li, setLi] = useState<LiStatus | null>(null);
  const [liText, setLiText] = useState("");
  const [liLoading, setLiLoading] = useState(false);
  const [liSource, setLiSource] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/linkedin/status").then((r) => r.json()).then((d: LiStatus) => setLi(d)).catch(() => setLi(null));
  }, []);

  const liReady = Boolean(li?.connected && li?.canPostOrg);

  async function generateLi() {
    setLiLoading(true);
    try {
      const { ok, data } = await postJson("/api/linkedin/generate", {
        title: draft.title, content: draft.content, metaDescription: draft.metaDescription,
        focusKeyphrase: draft.focusKeyphrase, tags: splitList(draft.tags), url: wpLink || undefined,
      });
      if (ok) { setLiText(data.text || ""); setLiSource(data.source || null); }
    } finally { setLiLoading(false); }
  }

  // When LinkedIn is first enabled, draft a post automatically.
  useEffect(() => {
    if (toLi && !liText && !liLoading) generateLi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toLi]);

  async function test() {
    setBusy(true); setError(null); setTested(null);
    try {
      const { ok, data } = await postJson("/api/wordpress/test", { url, username, applicationPassword });
      if (!ok) setError(data.error);
      else {
        const b = data.bridge;
        const note = b?.installed ? ` Bridge active${b.seoPlugin ? ` (${b.seoPlugin})` : ""}.` : " Bridge not detected (install it for SEO meta).";
        setTested(`Connected as ${data.user.name}.${note}`);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function publish() {
    if (!toWp && !toLi) { setError("Pick at least one destination."); return; }
    setBusy(true); setError(null);
    try {
      let link = wpLink;
      let doneStatus: string | undefined;
      let newWpId: number | undefined;
      const parts: string[] = [];

      if (toWp) {
        const body: Record<string, unknown> = {
          title: draft.title, content: draft.content, metaDescription: draft.metaDescription,
          focusKeyphrase: draft.focusKeyphrase, secondaryKeyphrases: splitList(draft.secondaryKeyphrases),
          slug: draft.slug, tags: splitList(draft.tags), categories: splitList(draft.categories),
          status, pingIndexNow, articleId, wpPostId: wpPostId ?? undefined,
          coverImage: coverImage || undefined, coverMediaId: coverMediaId ?? undefined,
        };
        if (!multiUser) { body.url = url; body.username = username; body.applicationPassword = applicationPassword; }
        const { ok, data } = await postJson("/api/wordpress/publish", body);
        if (!ok) { setError(data.error); return; }
        link = data.post?.link || link;
        newWpId = data.wpPostId;
        doneStatus = status === "publish" ? "published" : undefined;
        const verb = data.updated ? "Updated" : status === "publish" ? "Published" : "Saved as draft";
        parts.push(`${verb} on WordPress${status === "publish" && link ? `: ${link}` : ` (#${data.post?.id ?? newWpId})`}.`);
      }

      if (toLi) {
        const commentary = link ? `${liText}\n\n${link}` : liText;
        const { ok, data } = await postJson("/api/linkedin/post", { target: "organization", commentary });
        if (!ok) {
          setError(`${parts.join(" ")}${parts.length ? " " : ""}LinkedIn share failed: ${data.error}`);
          return;
        }
        parts.push("Shared to your LinkedIn company page.");
      }

      onDone(parts.join(" "), doneStatus, newWpId);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const tags = splitList(draft.tags);
  const excerpt = (draft.metaDescription.trim() || stripHtml(draft.content)).slice(0, 220);
  const linkForPreview = wpLink || (draft.slug && url ? `${url.replace(/\/$/, "")}/${draft.slug}` : "");
  const showTab = toWp && toLi ? tab : toWp ? "wordpress" : "linkedin";

  const cta = toWp && toLi ? "Publish & Share" : toLi ? "Share to LinkedIn" : status === "publish" ? "Publish" : "Save draft";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">Publish<button className="modal-close" onClick={onClose} aria-label="Close">×</button></div>
        <div className="card-body">
          {error && <div className="banner error">{error}</div>}
          {tested && <div className="banner success">{tested}</div>}

          {/* Destinations */}
          <div className="dest-row">
            <button type="button" className={`dest ${toWp ? "on" : ""}`} onClick={() => { setToWp((v) => !v); setTab("wordpress"); }}>
              <span className="dest-ico" aria-hidden>🌐</span>
              <span className="dest-text"><span className="dest-name">WordPress</span><span className="dest-sub">{multiUser ? "Company blog" : "Your site"}</span></span>
              <span className={`dest-check ${toWp ? "on" : ""}`}>{toWp ? "✓" : ""}</span>
            </button>
            <button type="button" className={`dest ${toLi ? "on" : ""} ${!liReady ? "muted" : ""}`}
              onClick={() => { if (!liReady) return; setToLi((v) => !v); setTab("linkedin"); }}
              disabled={!liReady} title={liReady ? "" : "Connect LinkedIn (company page) first"}>
              <span className="dest-ico" aria-hidden>in</span>
              <span className="dest-text"><span className="dest-name">LinkedIn</span><span className="dest-sub">{liReady ? "Company page" : li?.connected ? "No org configured" : "Not connected"}</span></span>
              <span className={`dest-check ${toLi ? "on" : ""}`}>{toLi ? "✓" : ""}</span>
            </button>
          </div>

          {/* LinkedIn connect helper */}
          {!liReady && (
            <div className="hint" style={{ marginBottom: 12 }}>
              {li?.configured
                ? li?.connected
                  ? "LinkedIn is connected but no company page (org) is set — add LINKEDIN_ORG_ID / the company page ID in Admin."
                  : <>To share to your company page, <a href="/api/linkedin/auth">connect LinkedIn</a> (you must be a page admin).</>
                : "LinkedIn isn’t configured on this deployment yet (see SETUP.md)."}
            </div>
          )}

          {/* Tabs (only when both selected) */}
          {toWp && toLi && (
            <div className="seg-tabs" role="tablist">
              <button className={showTab === "wordpress" ? "active" : ""} onClick={() => setTab("wordpress")}>WordPress</button>
              <button className={showTab === "linkedin" ? "active" : ""} onClick={() => setTab("linkedin")}>LinkedIn</button>
            </div>
          )}

          {/* WordPress panel */}
          {showTab === "wordpress" && toWp && (
            <div className="pub-grid">
              <div className="pub-settings">
                {multiUser
                  ? <div className="banner info" style={{ marginTop: 0 }}>Publishing to the shared company blog configured by your admin.</div>
                  : (
                    <>
                      <div className="field" style={{ marginTop: 0 }}><label>Site URL</label><input type="text" value={url} placeholder="https://blog.example.com" onChange={(e) => setUrl(e.target.value)} /></div>
                      <div className="field"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                      <div className="field"><label>Application Password</label><PasswordInput value={applicationPassword} onChange={setApplicationPassword} placeholder="xxxx xxxx xxxx xxxx" autoComplete="off" /></div>
                      <button className="btn" style={{ marginTop: 10 }} onClick={test} disabled={busy}>{busy && <span className="spinner" />} Test connection</button>
                    </>
                  )}
                <div className="field"><label>Publish as</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "publish")}>
                    <option value="publish">Publish immediately</option>
                    <option value="draft">Draft (review in WP first)</option>
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <input type="checkbox" checked={pingIndexNow} onChange={(e) => setPingIndexNow(e.target.checked)} style={{ width: "auto" }} />
                  Notify search engines via IndexNow
                </label>
              </div>
              <div className="pub-preview">
                <div className="preview-label">Preview</div>
                <article className="wp-preview">
                  {coverImage && <img className="wp-cover" src={coverImage} alt="" />}
                  <h3 className="wp-title">{draft.title || "Untitled article"}</h3>
                  <p className="wp-excerpt">{excerpt || "Your article content will appear here."}</p>
                  {tags.length > 0 && <div className="wp-tags">{tags.slice(0, 6).map((t) => <span key={t} className="chip">{t}</span>)}</div>}
                </article>
              </div>
            </div>
          )}

          {/* LinkedIn panel */}
          {showTab === "linkedin" && toLi && (
            <div className="pub-grid">
              <div className="pub-settings">
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Post text {liSource && <span className="counter">{liSource === "ai" ? "AI draft" : "rule-based"}</span>}</label>
                  <textarea rows={9} value={liText} placeholder="Your LinkedIn post…" onChange={(e) => setLiText(e.target.value)} />
                </div>
                <button className="btn" onClick={generateLi} disabled={liLoading}>{liLoading && <span className="spinner" />} ↻ Regenerate</button>
                <div className="hint" style={{ marginTop: 8 }}>The article link is added automatically; LinkedIn turns it into a preview card.</div>
              </div>
              <div className="pub-preview">
                <div className="preview-label">Preview</div>
                <LinkedInPreview text={liText} companyName={li?.name || "Your Company Page"} coverImage={coverImage} title={draft.title} link={linkForPreview} />
              </div>
            </div>
          )}

        </div>
        <div className="btn-row pub-foot" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={publish} disabled={busy || (!toWp && !toLi)}>{busy && <span className="spinner" />} {cta}</button>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ text, companyName, coverImage, title, link }: {
  text: string; companyName: string; coverImage: string; title: string; link: string;
}) {
  const initial = companyName.trim().charAt(0).toUpperCase() || "C";
  return (
    <div className="li-card">
      <div className="li-head">
        {coverImage ? <img className="li-avatar-img" src={coverImage} alt="" /> : <div className="li-avatar">{initial}</div>}
        <div className="li-meta">
          <div className="li-name">{companyName}</div>
          <div className="li-sub">Company · Now · 🌐</div>
        </div>
        <div className="li-more">···</div>
      </div>
      <div className="li-body">{text || "Your post text will appear here…"}</div>
      {link && (
        <div className="li-link-card">
          {coverImage && <img className="li-link-img" src={coverImage} alt="" />}
          <div className="li-link-meta">
            <div className="li-link-title">{title || "Article"}</div>
            <div className="li-link-domain">{domainOf(link) || "your site"}</div>
          </div>
        </div>
      )}
      <div className="li-actions">
        <span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>➤ Send</span>
      </div>
    </div>
  );
}
