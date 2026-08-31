"use client";

import type { Me } from "./useMe";
import { canReviewRole, isAdminRole } from "./useMe";

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

export default function AppHeader({
  me,
  authEnabled,
  active,
}: {
  me: Me | null;
  authEnabled: boolean;
  active?: "editor" | "articles" | "admin";
}) {
  return (
    <header className="app-header">
      <h1>
        <a href="/" style={{ textDecoration: "none", color: "inherit" }}>
          🔍 SEO Engine
        </a>{" "}
        <span className="tag">Blog Post Optimizer</span>
      </h1>

      <div className="nav">
        {authEnabled && me && (
          <>
            <a href="/" style={{ color: active === "editor" ? "var(--text)" : undefined }}>
              Editor
            </a>
            <a href="/articles" style={{ color: active === "articles" ? "var(--text)" : undefined }}>
              {canReviewRole(me.role) ? "Articles & Queue" : "My articles"}
            </a>
            {isAdminRole(me.role) && (
              <a href="/admin" style={{ color: active === "admin" ? "var(--text)" : undefined }}>
                Admin
              </a>
            )}
            <span className="usermenu">
              <span className={`role-badge ${me.role}`}>{me.role}</span>
              {me.name || me.email}
              <button className="btn" style={{ padding: "4px 10px" }} onClick={logout}>
                Sign out
              </button>
            </span>
          </>
        )}
      </div>
    </header>
  );
}
