"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useMe, canReviewRole } from "../components/useMe";

interface ArticleRow {
  id: string;
  title: string;
  status: "draft" | "in_review" | "published";
  overallScore: number | null;
  authorName: string | null;
  authorEmail: string;
  updatedAt: string;
  wpLink: string | null;
}

export default function ArticlesPage() {
  const { me, authEnabled, loading } = useMe();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [filter, setFilter] = useState<"all" | "in_review">("all");

  const load = useCallback(async () => {
    const q = filter === "in_review" ? "?status=in_review" : "";
    const r = await fetch(`/api/articles${q}`);
    if (r.ok) setArticles((await r.json()).articles);
  }, [filter]);

  useEffect(() => {
    if (me) load();
  }, [me, load]);

  if (loading) return null;
  if (!authEnabled || !me) {
    return (
      <>
        <AppHeader me={me} authEnabled={authEnabled} active="articles" />
        <div className="page"><div className="banner info">Saved articles require accounts to be enabled.</div></div>
      </>
    );
  }

  const canReview = canReviewRole(me.role);

  return (
    <>
      <AppHeader me={me} authEnabled={authEnabled} active="articles" />
      <div className="page">
        <div className="card">
          <div className="card-header">
            {canReview ? "All articles" : "My articles"}
            <div className="btn-row">
              {canReview && (
                <>
                  <button className={`btn ${filter === "all" ? "primary" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setFilter("all")}>All</button>
                  <button className={`btn ${filter === "in_review" ? "primary" : ""}`} style={{ padding: "4px 10px" }} onClick={() => setFilter("in_review")}>Review queue</button>
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
                    <th>Status</th>
                    <th>Score</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((a) => (
                    <tr key={a.id}>
                      <td>{a.title || "(untitled)"}</td>
                      {canReview && <td>{a.authorName || a.authorEmail}</td>}
                      <td><span className={`status-pill ${a.status}`}>{a.status.replace("_", " ")}</span></td>
                      <td>{a.overallScore ?? "—"}</td>
                      <td>{new Date(a.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <a className="btn" style={{ padding: "3px 10px", textDecoration: "none" }} href={`/?id=${a.id}`}>
                          {a.status === "in_review" && canReview ? "Review" : "Open"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
