"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  sentenceCount: number;
  paragraphCount: number;
  keyphraseDensity: number | null;
  keyphraseCount: number | null;
  titleWidthPx: number;
  metaDescriptionLength: number;
  linkCount: number;
  internalLinkCount: number;
  outboundLinkCount: number;
  imageCount: number;
}

interface Analysis {
  checks: CheckResult[];
  readabilityScore: number;
  seoScore: number;
  overallScore: number;
  overallStatus: Status;
  metrics: Metrics;
}

interface Suggestion {
  checkId?: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
}

interface Draft {
  title: string;
  content: string;
  metaDescription: string;
  focusKeyphrase: string;
  slug: string;
}

const EXAMPLE: Draft = {
  title: "Remote Team Productivity: A Practical Guide",
  focusKeyphrase: "remote team productivity",
  slug: "remote-team-productivity-guide",
  metaDescription:
    "Boost remote team productivity with practical routines, the right tools, and async habits your team will actually stick to.",
  content: `## Why remote team productivity is different

Managing a distributed team is not the same as managing an office. The old signals are gone. You cannot glance across the room to see who is stuck. Remote team productivity depends on clear systems, not proximity.

## Set up async communication

Meetings were used by managers to stay informed. That habit does not scale across time zones. Write decisions down. Use a shared doc. Record short videos instead of scheduling another call.

## Choose the right tools

A good stack is small. Pick one place for chat, one for docs, and one for tasks. Too many tools were adopted by teams that later regretted it.

## Measure outcomes, not hours

Track shipped work. Review it weekly. Celebrate progress in public so people feel seen.`,
};

function scoreClass(n: number): string {
  return n >= 75 ? "good-text" : n >= 50 ? "ok-text" : "bad-text";
}

export default function Home() {
  const [draft, setDraft] = useState<Draft>({
    title: "",
    content: "",
    metaDescription: "",
    focusKeyphrase: "",
    slug: "",
  });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [fixLoading, setFixLoading] = useState(false);
  const [fixPreview, setFixPreview] = useState<null | {
    fixed: Draft & { changes: string[] };
    before: { overallScore: number };
    after: Analysis;
  }>(null);

  const [publishOpen, setPublishOpen] = useState(false);
  const [banner, setBanner] = useState<
    null | { kind: "error" | "success" | "info"; text: string }
  >(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const runAnalyze = useCallback(async (d: Draft) => {
    if (!d.title.trim() && !d.content.trim()) {
      setAnalysis(null);
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const data = await res.json();
      if (res.ok) setAnalysis(data as Analysis);
    } catch {
      /* ignore transient analyze errors */
    } finally {
      setAnalyzing(false);
    }
  }, []);

  // Debounced live analysis.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runAnalyze(draft), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [draft, runAnalyze]);

  async function getSuggestions() {
    setSuggestLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error || "Could not get suggestions." });
        return;
      }
      setSuggestions(data.suggestions as Suggestion[]);
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setSuggestLoading(false);
    }
  }

  async function runAutoFix() {
    setFixLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/ai/autofix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: data.error || "Auto-fix failed." });
        return;
      }
      setFixPreview({
        fixed: {
          title: data.fixed.title,
          content: data.fixed.content,
          metaDescription: data.fixed.metaDescription,
          focusKeyphrase: data.fixed.focusKeyphrase,
          slug: data.fixed.slug,
          changes: data.fixed.changes ?? [],
        },
        before: data.before,
        after: data.after,
      });
    } catch (e) {
      setBanner({ kind: "error", text: (e as Error).message });
    } finally {
      setFixLoading(false);
    }
  }

  function applyFix() {
    if (!fixPreview) return;
    const { changes: _c, ...rest } = fixPreview.fixed;
    setDraft(rest);
    setAnalysis(fixPreview.after);
    setFixPreview(null);
    setBanner({ kind: "success", text: "Applied the AI-optimized version. Review it and publish when ready." });
  }

  const seoChecks = analysis?.checks.filter((c) => c.category === "seo") ?? [];
  const readChecks = analysis?.checks.filter((c) => c.category === "readability") ?? [];

  const titleWarn =
    analysis && analysis.metrics.titleWidthPx > 580 ? "bad" : analysis && analysis.metrics.titleWidthPx > 520 ? "warn" : "";
  const metaLen = draft.metaDescription.trim().length;
  const metaWarn = metaLen > 158 ? "bad" : metaLen > 0 && metaLen < 120 ? "warn" : "";

  return (
    <>
      <header className="app-header">
        <h1>
          🔍 SEO Engine <span className="tag">Blog Post Optimizer</span>
        </h1>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              setDraft(EXAMPLE);
              setSuggestions(null);
            }}
          >
            Load example
          </button>
          <button
            className="btn primary"
            onClick={() => setPublishOpen(true)}
            disabled={!draft.title.trim() || !draft.content.trim()}
          >
            Publish to WordPress
          </button>
        </div>
      </header>

      <div className="layout">
        {/* ---- Editor ---- */}
        <div>
          {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}

          <div className="card">
            <div className="card-header">Post</div>
            <div className="card-body">
              <div className="field">
                <label>
                  SEO Title
                  {analysis && (
                    <span className={`counter ${titleWarn}`}>
                      ~{analysis.metrics.titleWidthPx}px
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={draft.title}
                  placeholder="Your compelling, keyword-rich title"
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>Focus Keyphrase</label>
                  <input
                    type="text"
                    value={draft.focusKeyphrase}
                    placeholder="e.g. remote team productivity"
                    onChange={(e) => set("focusKeyphrase", e.target.value)}
                  />
                </div>
                <div className="field" style={{ marginTop: 0 }}>
                  <label>URL Slug</label>
                  <input
                    type="text"
                    value={draft.slug}
                    placeholder="remote-team-productivity"
                    onChange={(e) => set("slug", e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label>
                  Meta Description
                  <span className={`counter ${metaWarn}`}>{metaLen}/158</span>
                </label>
                <textarea
                  rows={2}
                  value={draft.metaDescription}
                  placeholder="A 120-158 character summary that earns the click."
                  onChange={(e) => set("metaDescription", e.target.value)}
                />
              </div>

              <div className="field">
                <label>Content (Markdown or HTML)</label>
                <textarea
                  className="content"
                  value={draft.content}
                  placeholder="Write or paste your post here…"
                  onChange={(e) => set("content", e.target.value)}
                />
                <div className="hint">
                  Paste from your WordPress editor (HTML) or write in Markdown — both work.
                </div>
              </div>

              <div className="btn-row" style={{ marginTop: 14 }}>
                <button className="btn" onClick={getSuggestions} disabled={suggestLoading || !draft.content.trim()}>
                  {suggestLoading && <span className="spinner" />} Get AI suggestions
                </button>
                <button className="btn primary" onClick={runAutoFix} disabled={fixLoading || !draft.content.trim()}>
                  {fixLoading && <span className="spinner" />} ✨ Auto-fix with AI
                </button>
              </div>
            </div>
          </div>

          {suggestions && (
            <div className="card">
              <div className="card-header">
                AI Suggestions
                <button className="btn" onClick={() => setSuggestions(null)} style={{ padding: "2px 8px" }}>
                  Clear
                </button>
              </div>
              <div className="card-body">
                {suggestions.length === 0 && <div className="hint">No suggestions — looks solid!</div>}
                {suggestions.map((s, i) => (
                  <div className="suggestion" key={i}>
                    <div className="s-head">
                      <span className={`prio ${s.priority}`}>{s.priority}</span>
                      {s.title}
                    </div>
                    <div className="s-detail">{s.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---- Analysis panel ---- */}
        <div>
          <div className="card">
            <div className="card-header">
              Score
              {analyzing && <span className="spinner" />}
            </div>
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
                    <div><span className="k">Sentences</span><span>{analysis.metrics.sentenceCount}</span></div>
                    <div><span className="k">Paragraphs</span><span>{analysis.metrics.paragraphCount}</span></div>
                    <div>
                      <span className="k">Keyphrase density</span>
                      <span>
                        {analysis.metrics.keyphraseDensity != null
                          ? `${(analysis.metrics.keyphraseDensity * 100).toFixed(1)}% (${analysis.metrics.keyphraseCount}×)`
                          : "—"}
                      </span>
                    </div>
                    <div><span className="k">Links (int/ext)</span><span>{analysis.metrics.internalLinkCount}/{analysis.metrics.outboundLinkCount}</span></div>
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

      {fixPreview && (
        <FixPreviewModal
          preview={fixPreview}
          onApply={applyFix}
          onClose={() => setFixPreview(null)}
        />
      )}

      {publishOpen && (
        <PublishModal
          draft={draft}
          onClose={() => setPublishOpen(false)}
          onDone={(msg) => {
            setPublishOpen(false);
            setBanner({ kind: "success", text: msg });
          }}
        />
      )}
    </>
  );
}

function Gauge({ label, value }: { label: string; value: number }) {
  return (
    <div className="gauge">
      <div className={`num ${scoreClass(value)}`}>{value}</div>
      <div className="lbl">{label}</div>
    </div>
  );
}

function Check({ c }: { c: CheckResult }) {
  return (
    <div className="check">
      <span className={`dot ${c.status}`} />
      <div>
        <div className="c-label">
          {c.label}
          {c.aiFixable && c.status !== "good" && <span className="badge">AI-fixable</span>}
        </div>
        <div className="c-msg">{c.message}</div>
      </div>
    </div>
  );
}

function FixPreviewModal({
  preview,
  onApply,
  onClose,
}: {
  preview: { fixed: Draft & { changes: string[] }; before: { overallScore: number }; after: Analysis };
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          ✨ AI-Optimized Version
          <span>
            <span className="bad-text">{preview.before.overallScore}</span>
            {" → "}
            <span className="good-text">{preview.after.overallScore}</span>
          </span>
        </div>
        <div className="card-body">
          <div className="field" style={{ marginTop: 0 }}>
            <label>New title</label>
            <input type="text" readOnly value={preview.fixed.title} />
          </div>
          <div className="field">
            <label>New meta description</label>
            <textarea rows={2} readOnly value={preview.fixed.metaDescription} />
          </div>
          {preview.fixed.changes.length > 0 && (
            <>
              <label style={{ marginTop: 14 }}>What changed</label>
              <ul className="diff-changes">
                {preview.fixed.changes.map((ch, i) => <li key={i}>{ch}</li>)}
              </ul>
            </>
          )}
          <div className="field">
            <label>New content preview</label>
            <textarea className="content" style={{ minHeight: 180 }} readOnly value={preview.fixed.content} />
          </div>
          <div className="btn-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>Discard</button>
            <button className="btn primary" onClick={onApply}>Apply changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublishModal({
  draft,
  onClose,
  onDone,
}: {
  draft: Draft;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");
  const [status, setStatus] = useState<"draft" | "publish">("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tested, setTested] = useState<string | null>(null);

  const creds = () => ({ url, username, applicationPassword });

  async function test() {
    setBusy(true);
    setError(null);
    setTested(null);
    try {
      const res = await fetch("/api/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creds()),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else setTested(`Connected as ${data.user.name}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wordpress/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...creds(),
          title: draft.title,
          content: draft.content,
          metaDescription: draft.metaDescription,
          slug: draft.slug,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      onDone(
        status === "publish"
          ? `Published! View it at ${data.post.link}`
          : `Saved as draft in WordPress (post #${data.post.id}).`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">Publish to WordPress</div>
        <div className="card-body">
          <div className="banner info">
            Uses an Application Password (WP Admin → Users → Profile → Application
            Passwords). Leave fields blank to use server-side env defaults.
          </div>
          {error && <div className="banner error">{error}</div>}
          {tested && <div className="banner success">{tested}</div>}

          <div className="field" style={{ marginTop: 0 }}>
            <label>Site URL</label>
            <input type="text" value={url} placeholder="https://blog.example.com" onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="field">
            <label>Username</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label>Application Password</label>
            <input type="text" value={applicationPassword} placeholder="xxxx xxxx xxxx xxxx" onChange={(e) => setApplicationPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Publish as</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "publish")}>
              <option value="draft">Draft (review in WP first)</option>
              <option value="publish">Publish immediately</option>
            </select>
          </div>

          <div className="btn-row" style={{ marginTop: 16, justifyContent: "space-between" }}>
            <button className="btn" onClick={test} disabled={busy}>
              {busy && <span className="spinner" />} Test connection
            </button>
            <div className="btn-row">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={publish} disabled={busy}>
                {busy && <span className="spinner" />} {status === "publish" ? "Publish" : "Save draft"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
