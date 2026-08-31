"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppHeader from "./components/AppHeader";
import { useMe, canPublishRole } from "./components/useMe";

type Status = "good" | "ok" | "bad";

interface CheckResult {
  id: string;
  category: "seo" | "readability";
  label: string;
  status: Status;
  message: string;
  aiFixable: boolean;
}

interface Metrics {
  wordCount: number;
  fleschReadingEase: number;
  keyphraseDensity: number | null;
  keyphraseCount: number | null;
  titleWidthPx: number;
  internalLinkCount: number;
  outboundLinkCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  tagCount: number;
  categoryCount: number;
}

interface Analysis {
  checks: CheckResult[];
  readabilityScore: number;
  seoScore: number;
  overallScore: number;
  metrics: Metrics;
}

interface Suggestion {
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

interface Draft {
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  secondaryKeyphrases: string;
  slug: string;
  tags: string;
  categories: string;
}

const EMPTY: Draft = {
  title: "", content: "", metaDescription: "", focusKeyphrase: "",
  secondaryKeyphrases: "", slug: "", tags: "", categories: "",
};

const EXAMPLE: Draft = {
  title: "Remote Team Productivity: A Practical Guide",
  focusKeyphrase: "remote team productivity",
  secondaryKeyphrases: "async communication, distributed teams",
  slug: "remote-team-productivity-guide",
  tags: "remote work, productivity, management",
  categories: "Team Management",
  metaDescription:
    "Boost remote team productivity with practical routines, the right tools, and async habits your team will actually stick to.",
  content: `## Why remote team productivity is different

Managing a distributed team is not the same as managing an office. The old signals are gone. Remote team productivity depends on clear systems, not proximity.

## Set up async communication

Write decisions down. Use a shared doc. Record short videos instead of scheduling another call.

## Measure outcomes, not hours

Track shipped work. Review it weekly. Celebrate progress in public so people feel seen.`,
};

const splitList = (s: string): string[] => s.split(",").map((x) => x.trim()).filter(Boolean);
const joinList = (a?: string[] | null): string => (a ?? []).join(", ");
const scoreClass = (n: number) => (n >= 75 ? "good-text" : n >= 50 ? "ok-text" : "bad-text");

export default function Home() {
  const { me, authEnabled } = useMe();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [articleId, setArticleId] = useState<string | null>(null);
  const [articleStatus, setArticleStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [altLoading, setAltLoading] = useState(false);
  const [fixPreview, setFixPreview] = useState<null | {
    fixed: Draft & { changes: string[] };
    before: { overallScore: number };
    after: Analysis;
  }>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [banner, setBanner] = useState<null | { kind: "error" | "success" | "info"; text: string }>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const payload = useCallback((d: Draft) => ({
    title: d.title, content: d.content, metaDescription: d.metaDescription,
    focusKeyphrase: d.focusKeyphrase, secondaryKeyphrases: splitList(d.secondaryKeyphrases),
    slug: d.slug, tags: splitList(d.tags), categories: splitList(d.categories),
  }), []);

  // Load a saved article when opened via /?id=...
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    fetch(`/api/articles/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.article) return;
        const a = d.article;
        setDraft({
          title: a.title, content: a.content, metaDescription: a.metaDescription,
          focusKeyphrase: a.focusKeyphrase, secondaryKeyphrases: joinList(a.secondaryKeyphrases),
          slug: a.slug, tags: joinList(a.tags), categories: joinList(a.categories),
        });
        setArticleId(a.id);
        setArticleStatus(a.status);
      })
      .catch(() => {});
  }, []);

  const runAnalyze = useCallback(async (d: Draft) => {
    if (!d.title.trim() && !d.content.trim()) { setAnalysis(null); return; }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(d)),
      });
      const data = await res.json();
      if (res.ok) setAnalysis(data as Analysis);
    } catch { /* ignore */ } finally { setAnalyzing(false); }
  }, [payload]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runAnalyze(draft), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft, runAnalyze]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const li = p.get("linkedin");
    if (li === "connected") setBanner({ kind: "success", text: "LinkedIn connected. Post from the Distribute panel." });
    else if (li === "error") setBanner({ kind: "error", text: `LinkedIn connection failed: ${p.get("reason") || "unknown"}` });
  }, []);

  async function saveDraft(): Promise<string | null> {
    setSaving(true);
    setBanner(null);
    try {
      const body = { ...payload(draft), overallScore: analysis?.overallScore ?? null };
      const res = await fetch(articleId ? `/api/articles/${articleId}` : "/api/articles", {
        method: articleId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setBanner({ kind: "error", text: data.error || "Save failed." }); return null; }
      const id = data.article.id as string;
      setArticleId(id);
      setArticleStatus(data.article.status);
      setBanner({ kind: "success", text: "Draft saved." });
      return id;
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    const id = (await saveDraft()) ?? articleId;
    if (!id) return;
    const res = await fetch(`/api/articles/${id}/submit`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setBanner({ kind: "error", text: data.error }); return; }
    setArticleStatus("in_review");
    setBanner({ kind: "success", text: "Submitted for review. An editor will approve and publish it." });
  }

  async function getSuggestions() {
    setSuggestLoading(true); setBanner(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(draft)),
      });
      const data = await res.json();
      if (!res.ok) { setBanner({ kind: "error", text: data.error || "Could not get suggestions." }); return; }
      setSuggestions(data.suggestions as Suggestion[]);
    } catch (e) { setBanner({ kind: "error", text: (e as Error).message }); }
    finally { setSuggestLoading(false); }
  }

  async function runAutoFix() {
    setFixLoading(true); setBanner(null);
    try {
      const res = await fetch("/api/ai/autofix", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(draft)),
      });
      const data = await res.json();
      if (!res.ok) { setBanner({ kind: "error", text: data.error || "Auto-fix failed." }); return; }
      setFixPreview({
        fixed: {
          title: data.fixed.title, content: data.fixed.content, metaDescription: data.fixed.metaDescription,
          focusKeyphrase: data.fixed.focusKeyphrase, secondaryKeyphrases: joinList(data.fixed.secondaryKeyphrases),
          slug: data.fixed.slug, tags: joinList(data.fixed.tags), categories: joinList(data.fixed.categories),
          changes: data.fixed.changes ?? [],
        },
        before: data.before, after: data.after,
      });
    } catch (e) { setBanner({ kind: "error", text: (e as Error).message }); }
    finally { setFixLoading(false); }
  }

  async function generateAltText() {
    setAltLoading(true); setBanner(null);
    try {
      const res = await fetch("/api/ai/alt-text", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.content, focusKeyphrase: draft.focusKeyphrase, title: draft.title }),
      });
      const data = await res.json();
      if (!res.ok) { setBanner({ kind: "error", text: data.error || "Alt text failed." }); return; }
      if ((data.generated ?? []).length === 0) { setBanner({ kind: "info", text: "No images were missing alt text." }); return; }
      set("content", data.content);
      setBanner({ kind: "success", text: `Added alt text to ${data.generated.length} image(s).` });
    } catch (e) { setBanner({ kind: "error", text: (e as Error).message }); }
    finally { setAltLoading(false); }
  }

  function applyFix() {
    if (!fixPreview) return;
    const { changes: _c, ...rest } = fixPreview.fixed;
    setDraft(rest);
    setAnalysis(fixPreview.after);
    setFixPreview(null);
    setBanner({ kind: "success", text: "Applied the AI-optimized version." });
  }

  const seoChecks = analysis?.checks.filter((c) => c.category === "seo") ?? [];
  const readChecks = analysis?.checks.filter((c) => c.category === "readability") ?? [];
  const metaLen = draft.metaDescription.trim().length;
  const metaWarn = metaLen > 158 ? "bad" : metaLen > 0 && metaLen < 120 ? "warn" : "";
  const titleWarn = analysis && analysis.metrics.titleWidthPx > 580 ? "bad" : analysis && analysis.metrics.titleWidthPx > 520 ? "warn" : "";
  const missingAlt = analysis?.metrics.imagesMissingAlt ?? 0;

  // Publish permission: single-user mode allows it; multi-user needs editor+.
  const mayPublish = !authEnabled || canPublishRole(me?.role);
  const hasContent = draft.title.trim() && draft.content.trim();

  return (
    <>
      <AppHeader me={me} authEnabled={authEnabled} active="editor" />

      <div className="layout">
        <div>
          {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

          <div className="card">
            <div className="card-header">
              Post
              <div className="btn-row">
                {articleStatus && <span className={`status-pill ${articleStatus}`}>{articleStatus.replace("_", " ")}</span>}
                <button className="btn" style={{ padding: "3px 10px" }} onClick={() => { setDraft(EXAMPLE); setSuggestions(null); }}>Load example</button>
              </div>
            </div>
            <div className="card-body">
              <div className="field">
                <label>SEO Title{analysis && <span className={`counter ${titleWarn}`}>~{analysis.metrics.titleWidthPx}px</span>}</label>
                <input type="text" value={draft.title} placeholder="Your compelling, keyword-rich title" onChange={(e) => set("title", e.target.value)} />
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Focus Keyphrase</label>
                  <input type="text" value={draft.focusKeyphrase} placeholder="e.g. remote team productivity" onChange={(e) => set("focusKeyphrase", e.target.value)} />
                </div>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>URL Slug</label>
                  <input type="text" value={draft.slug} placeholder="remote-team-productivity" onChange={(e) => set("slug", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Secondary keyphrases <span className="hint" style={{ display: "inline" }}>(comma-separated)</span></label>
                <input type="text" value={draft.secondaryKeyphrases} placeholder="async communication, distributed teams" onChange={(e) => set("secondaryKeyphrases", e.target.value)} />
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Categories <span className="hint" style={{ display: "inline" }}>(comma-separated)</span></label>
                  <input type="text" value={draft.categories} placeholder="Team Management" onChange={(e) => set("categories", e.target.value)} />
                </div>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Tags <span className="hint" style={{ display: "inline" }}>(comma-separated)</span></label>
                  <input type="text" value={draft.tags} placeholder="remote work, productivity" onChange={(e) => set("tags", e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Meta Description<span className={`counter ${metaWarn}`}>{metaLen}/158</span></label>
                <textarea rows={2} value={draft.metaDescription} placeholder="A 120-158 character summary that earns the click." onChange={(e) => set("metaDescription", e.target.value)} />
              </div>
              <div className="field">
                <label>Content (Markdown or HTML)</label>
                <textarea className="content" value={draft.content} placeholder="Write or paste your post here…" onChange={(e) => set("content", e.target.value)} />
                <div className="hint">Paste from WordPress (HTML) or write Markdown — both work.</div>
              </div>

              <div className="btn-row" style={{ marginTop: 14 }}>
                <button className="btn" onClick={getSuggestions} disabled={suggestLoading || !draft.content.trim()}>
                  {suggestLoading && <span className="spinner" />} Get AI suggestions
                </button>
                <button className="btn" onClick={generateAltText} disabled={altLoading || missingAlt === 0} title={missingAlt === 0 ? "No images missing alt" : `${missingAlt} missing`}>
                  {altLoading && <span className="spinner" />} 🖼 Alt text{missingAlt > 0 ? ` (${missingAlt})` : ""}
                </button>
                <button className="btn primary" onClick={runAutoFix} disabled={fixLoading || !draft.content.trim()}>
                  {fixLoading && <span className="spinner" />} ✨ Auto-fix with AI
                </button>
              </div>

              {/* Save / publish workflow */}
              <div className="btn-row" style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                {authEnabled && (
                  <button className="btn" onClick={saveDraft} disabled={saving || !hasContent}>
                    {saving && <span className="spinner" />} 💾 Save draft
                  </button>
                )}
                {authEnabled && !mayPublish && (
                  <button className="btn primary" onClick={submitForReview} disabled={saving || !hasContent}>
                    Submit for review
                  </button>
                )}
                {mayPublish && (
                  <button className="btn primary" onClick={() => setPublishOpen(true)} disabled={!hasContent}>
                    Publish to WordPress
                  </button>
                )}
              </div>
              {authEnabled && !mayPublish && (
                <div className="hint" style={{ marginTop: 8 }}>
                  As an author you can write and submit for review. An editor approves and publishes.
                </div>
              )}
            </div>
          </div>

          {suggestions && (
            <div className="card">
              <div className="card-header">AI Suggestions<button className="btn" onClick={() => setSuggestions(null)} style={{ padding: "2px 8px" }}>Clear</button></div>
              <div className="card-body">
                {suggestions.length === 0 && <div className="hint">No suggestions — looks solid!</div>}
                {suggestions.map((s, i) => (
                  <div className="suggestion" key={i}>
                    <div className="s-head"><span className={`prio ${s.priority}`}>{s.priority}</span>{s.title}</div>
                    <div className="s-detail">{s.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <LinkedInPanel draft={draft} onBanner={setBanner} />
        </div>

        <div>
          <div className="card">
            <div className="card-header">Score{analyzing && <span className="spinner" />}</div>
            <div className="card-body">
              {!analysis ? (
                <div className="hint">Start typing to see your live SEO & readability score.</div>
              ) : (
                <>
                  <div className="scores">
                    <Gauge label="Overall" value={analysis.overallScore} />
                    <Gauge label="SEO" value={analysis.seoScore} />
                    <Gauge label="Readability" value={analysis.readabilityScore} />
                  </div>
                  <div className="metrics" style={{ marginTop: 16 }}>
                    <div><span className="k">Words</span><span>{analysis.metrics.wordCount}</span></div>
                    <div><span className="k">Reading ease</span><span>{analysis.metrics.fleschReadingEase}</span></div>
                    <div><span className="k">Keyphrase density</span><span>{analysis.metrics.keyphraseDensity != null ? `${(analysis.metrics.keyphraseDensity * 100).toFixed(1)}%` : "—"}</span></div>
                    <div><span className="k">Images (no alt)</span><span>{analysis.metrics.imageCount} ({analysis.metrics.imagesMissingAlt})</span></div>
                  </div>
                </>
              )}
            </div>
          </div>

          {analysis && (
            <div className="card">
              <div className="card-header">Checks</div>
              <div className="card-body" style={{ paddingTop: 6 }}>
                <div className="check-group-title">SEO</div>
                {seoChecks.map((c) => <Check key={c.id} c={c} />)}
                <div className="check-group-title">Readability</div>
                {readChecks.map((c) => <Check key={c.id} c={c} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {fixPreview && <FixPreviewModal preview={fixPreview} onApply={applyFix} onClose={() => setFixPreview(null)} />}
      {publishOpen && (
        <PublishModal
          draft={draft}
          articleId={articleId}
          multiUser={authEnabled}
          onClose={() => setPublishOpen(false)}
          onDone={(msg, status) => { setPublishOpen(false); if (status) setArticleStatus(status); setBanner({ kind: "success", text: msg }); }}
        />
      )}
    </>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return <div className="gauge"><div className={`num ${scoreClass(value)}`}>{value}</div><div className="lbl">{label}</div></div>;
}

function Check({ c }: { c: CheckResult }) {
  return (
    <div className="check">
      <span className={`dot ${c.status}`} />
      <div>
        <div className="c-label">{c.label}{c.aiFixable && c.status !== "good" && <span className="badge">AI-fixable</span>}</div>
        <div className="c-msg">{c.message}</div>
      </div>
    </div>
  );
}

function FixPreviewModal({ preview, onApply, onClose }: {
  preview: { fixed: Draft & { changes: string[] }; before: { overallScore: number }; after: Analysis };
  onApply: () => void; onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">✨ AI-Optimized Version<span><span className="bad-text">{preview.before.overallScore}</span>{" → "}<span className="good-text">{preview.after.overallScore}</span></span></div>
        <div className="card-body">
          <div className="field" style={{ marginTop: 0 }}><label>New title</label><input type="text" readOnly value={preview.fixed.title} /></div>
          <div className="field"><label>New meta description</label><textarea rows={2} readOnly value={preview.fixed.metaDescription} /></div>
          <div className="row">
            <div className="field"><label>Suggested tags</label><input type="text" readOnly value={preview.fixed.tags} /></div>
            <div className="field"><label>Suggested category</label><input type="text" readOnly value={preview.fixed.categories} /></div>
          </div>
          {preview.fixed.changes.length > 0 && (
            <><label style={{ marginTop: 14 }}>What changed</label><ul className="diff-changes">{preview.fixed.changes.map((ch, i) => <li key={i}>{ch}</li>)}</ul></>
          )}
          <div className="field"><label>New content preview</label><textarea className="content" style={{ minHeight: 180 }} readOnly value={preview.fixed.content} /></div>
          <div className="btn-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Discard</button>
            <button className="btn primary" onClick={onApply}>Apply changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishModal({ draft, articleId, multiUser, onClose, onDone }: {
  draft: Draft; articleId: string | null; multiUser: boolean;
  onClose: () => void; onDone: (msg: string, status?: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [pingIndexNow, setPingIndexNow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);

  async function test() {
    setBusy(true); setError(null); setTested(null);
    try {
      const res = await fetch("/api/wordpress/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username, applicationPassword }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else {
        const b = data.bridge;
        const note = b?.installed ? ` Bridge active${b.seoPlugin ? ` (${b.seoPlugin})` : ""}.` : " Bridge not detected (install it for SEO meta).";
        setTested(`Connected as ${data.user.name}.${note}`);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        title: draft.title, content: draft.content, metaDescription: draft.metaDescription,
        focusKeyphrase: draft.focusKeyphrase, secondaryKeyphrases: splitList(draft.secondaryKeyphrases),
        slug: draft.slug, tags: splitList(draft.tags), categories: splitList(draft.categories),
        status, pingIndexNow, articleId,
      };
      if (!multiUser) { body.url = url; body.username = username; body.applicationPassword = applicationPassword; }
      const res = await fetch("/api/wordpress/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const idx = data.indexNow?.ok ? " Search engines pinged via IndexNow." : "";
      onDone(
        status === "publish" ? `Published! ${data.post.link}.${idx}` : `Saved as draft in WordPress (#${data.post.id}).`,
        status === "publish" ? "published" : undefined,
      );
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">Publish to WordPress</div>
        <div className="card-body">
          {multiUser ? (
            <div className="banner info">Publishing to the shared company blog configured by your admin.</div>
          ) : (
            <div className="banner info">Uses an Application Password. Leave blank to use server env defaults. SEO meta needs the bridge plugin (see SETUP.md).</div>
          )}
          {error && <div className="banner error">{error}</div>}
          {tested && <div className="banner success">{tested}</div>}

          {!multiUser && (
            <>
              <div className="field" style={{ marginTop: 0 }}><label>Site URL</label><input type="text" value={url} placeholder="https://blog.example.com" onChange={(e) => setUrl(e.target.value)} /></div>
              <div className="field"><label>Username</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div className="field"><label>Application Password</label><input type="text" value={applicationPassword} placeholder="xxxx xxxx xxxx xxxx" onChange={(e) => setApplicationPassword(e.target.value)} /></div>
            </>
          )}
          <div className="field" style={{ marginTop: multiUser ? 0 : 14 }}><label>Publish as</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "publish")}>
              <option value="draft">Draft (review in WP first)</option>
              <option value="publish">Publish immediately</option>
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <input type="checkbox" checked={pingIndexNow} onChange={(e) => setPingIndexNow(e.target.checked)} style={{ width: "auto" }} />
            Notify search engines via IndexNow when published
          </label>

          <div className="btn-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
            {!multiUser ? <button className="btn" onClick={test} disabled={busy}>{busy && <span className="spinner" />} Test connection</button> : <span />}
            <div className="btn-row">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={publish} disabled={busy}>{busy && <span className="spinner" />} {status === "publish" ? "Publish" : "Save draft"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkedInPanel({ draft, onBanner }: {
  draft: Draft; onBanner: (b: { kind: "error" | "success" | "info"; text: string }) => void;
}) {
  const [state, setState] = useState<{ configured: boolean; connected: boolean; name?: string | null; orgId?: string | null }>({ configured: false, connected: false });
  const [text, setText] = useState("");
  const [target, setTarget] = useState<"member" | "organization">("member");
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => { fetch("/api/linkedin/status").then((r) => r.json()).then(setState).catch(() => {}); }, []);

  function useArticleAsIs() {
    const parts = [draft.title, draft.metaDescription].filter(Boolean);
    setText(parts.join("\n\n"));
  }

  async function draftPost() {
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/linkedin-draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.title, content: draft.content, focusKeyphrase: draft.focusKeyphrase }),
      });
      const data = await res.json();
      if (!res.ok) { onBanner({ kind: "error", text: data.error }); return; }
      setText(data.text);
    } catch (e) { onBanner({ kind: "error", text: (e as Error).message }); } finally { setDrafting(false); }
  }

  async function post() {
    setBusy(true);
    try {
      const res = await fetch("/api/linkedin/post", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentary: text, target, orgId: state.orgId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) { onBanner({ kind: "error", text: data.error }); return; }
      onBanner({ kind: "success", text: `Posted to LinkedIn${data.post.url ? `: ${data.post.url}` : "."}` });
    } catch (e) { onBanner({ kind: "error", text: (e as Error).message }); } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="card-header">Distribute · LinkedIn{state.connected ? <span className="counter">✓ {state.name || "connected"}</span> : null}</div>
      <div className="card-body">
        {!state.configured ? (
          <div className="hint">LinkedIn is not configured on the server (see SETUP.md).</div>
        ) : !state.connected ? (
          <a className="btn primary" href="/api/linkedin/auth">Connect LinkedIn</a>
        ) : (
          <>
            <div className="btn-row" style={{ marginBottom: 10 }}>
              <button className="btn" onClick={draftPost} disabled={drafting || !draft.content.trim()}>{drafting && <span className="spinner" />} ✨ AI-adapt for LinkedIn</button>
              <button className="btn" onClick={useArticleAsIs} disabled={!draft.title.trim()}>Use article as-is</button>
            </div>
            <textarea rows={7} value={text} placeholder="Write your LinkedIn post, generate one, or use the article as-is…" onChange={(e) => setText(e.target.value)} />
            <div className="btn-row" style={{ marginTop: 10, justifyContent: "space-between" }}>
              <select value={target} onChange={(e) => setTarget(e.target.value as "member" | "organization")} style={{ width: "auto" }}>
                <option value="member">My profile</option>
                <option value="organization" disabled={!state.orgId}>Company page{state.orgId ? "" : " (needs org ID)"}</option>
              </select>
              <button className="btn primary" onClick={post} disabled={busy || !text.trim()}>{busy && <span className="spinner" />} Post to LinkedIn</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
