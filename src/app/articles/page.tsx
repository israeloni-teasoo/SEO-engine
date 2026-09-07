"use client";

import { useCallback, useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useMe, canReviewRole } from "../components/useMe";

interface ArticleRow {
  id: string;
  title: string;
  status: "draft" | "in_review" | "published";
  overallScore: number | null;
  authorName: string | null;
  authorEmail: string;
  publisherName: string | null;
  wpPostId: number | null;
  updatedAt: string;
  wpLink: string | null;
}

export default function ArticlesPage() {
  const { me, authEnabled, loading } = useMe();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [filter, setFilter] = useState<"all" | "in_review" | "published">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = filter === "all" ? "" : `?status=${filter}`;
    const r = await fetch(`/api/articles${q}`);
    if (r.ok) setArticles((await r.json()).articles);
  }, [filter]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  async function manage(a: ArticleRow, action: "draft" | "publish" | "delete") {
    if (action === "delete" && !window.confirm(`Delete "${a.title || "this post"}" from WordPress? This cannot be undone.`)) return;
    setBusyId(a.id); setMsg(null);
    try {
      const res = await fetch("/api/wordpress/manage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wpPostId: a.wpPostId, action, articleId: a.id }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || "Action failed."); return; }
      setMsg(action === "delete" ? "Deleted from WordPress." : `Post set to ${action}.`);
      load();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusyId(null); }
  }

  if (loading) return null;
  if (!authEnabled || !me) {
    return (
      <AppShell me={me} authEnabled={authEnabled} active="articles">
        <div className="page"><div className="banner info">Saved articles require accounts to be enabled.</div></div>
      </AppShell>
    );
  }

  const canReview = canReviewRole(me.role);

  return (
    <AppShell me={me} authEnabled={authEnabled} active="articles">
      <div className="page">
        {msg && <div className="banner info">{msg}</div>}
        <div className="card">
          <div className="card-header">
            {canReview ? "Articles" : "My articles"}
            <div className="btn-row">
              {canReview && (
                <>
                  <button className={`btn ${filter === "all" ? "primary" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setFilter("all")}>All</button>
                  <button className={`btn ${filter === "in_review" ? "primary" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setFilter("in_review")}>Review queue</button>
                  <button className={`btn ${filter === "published" ? "primary" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setFilter("published")}>Published</button>
                </>
              )}
              <a className="btn primary" href="/" style={{ padding: "4px 10px", textDecoration: "none" }}>+ New article</a>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {articles.length === 0 ? (
              <div className="card-body"><div className="hint">No articles yet.</div></div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    {canReview && <th>Author</th>}
                    {canReview && <th>Published by</th>}
                    <th>Status</th>
                    <th>Score</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td>{a.wpLink ? <a href={a.wpLink} target="_blank" rel="noreferrer">{a.title || "(untitled)"}</a> : (a.title || "(untitled)")}</td>
                      {canReview && <td>{a.authorName || a.authorEmail}</td>}
                      {canReview && <td>{a.publisherName || "—"}</td>}
                      <td><span className={`status-pill ${a.status}`}>{a.status.replace("_", " ")}</span></td>
                      <td>{a.overallScore ?? "—"}</td>
                      <td>
                        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
                          <a className="btn" style={{ padding: "3px 10px", textDecoration: "none" }} href={`/?id=${a.id}`}>
                            {a.status === "in_review" && canReview ? "Review" : "Edit"}
                          </a>
                          {canReview && a.wpPostId && (
                            <>
                              {a.status === "published"
                                ? <button className="btn" style={{ padding: "3px 10px" }} disabled={busyId === a.id} onClick={() => manage(a, "draft")}>Unpublish</button>
                                : <button className="btn" style={{ padding: "3px 10px" }} disabled={busyId === a.id} onClick={() => manage(a, "publish")}>Publish</button>}
                              <button className="btn" style={{ padding: "3px 10px", color: "var(--bad)" }} disabled={busyId === a.id} onClick={() => manage(a, "delete")}>Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
