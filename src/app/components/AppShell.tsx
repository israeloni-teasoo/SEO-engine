"use client";

import type { ReactNode } from "react";
import type { Me } from "./useMe";
import { canReviewRole, isAdminRole } from "./useMe";
import ThemeToggle from "./ThemeToggle";

type Section = "editor" | "articles" | "admin";

const TITLES: Record<Section, string> = {
  editor: "Editor",
  articles: "Articles",
  admin: "Admin",
};

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login";
}

function NavItem({ href, active, icon, label }: { href: string; active: boolean; icon: string; label: string }) {
  return (
    <a href={href} className={`nav-item ${active ? "active" : ""}`}>
      <span className="nav-ico" aria-hidden>{icon}</span>
      <span>{label}</span>
    </a>
  );
}

export default function AppShell({
  me,
  authEnabled,
  active,
  children,
}: {
  me: Me | null;
  authEnabled: boolean;
  active?: Section;
  children: ReactNode;
}) {
  const showTeamNav = authEnabled && me;
  const articlesLabel = me && canReviewRole(me.role) ? "Articles & Queue" : "My articles";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a href="/" className="sidebar-brand">
          <span className="brand-mark">🔍</span>
          <span className="brand-text">
            SEO Engine
            <small>Blog Post Optimizer</small>
          </span>
        </a>

        <nav className="sidebar-nav">
          <NavItem href="/" active={active === "editor"} icon="✍️" label="Editor" />
          {showTeamNav && <NavItem href="/articles" active={active === "articles"} icon="📄" label={articlesLabel} />}
          {me && isAdminRole(me.role) && <NavItem href="/admin" active={active === "admin"} icon="⚙️" label="Admin" />}
        </nav>

        <div className="sidebar-foot">
          {authEnabled && me ? (
            <>
              <div className="side-user">
                <span className={`role-badge ${me.role}`}>{me.role}</span>
                <span className="side-user-name" title={me.email}>{me.name || me.email}</span>
              </div>
              <button className="btn" style={{ padding: "6px 10px", width: "100%" }} onClick={logout}>Sign out</button>
            </>
          ) : (
            <div className="side-user-name" style={{ color: "var(--muted)", fontSize: 12 }}>Single-user mode</div>
          )}
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">{active ? TITLES[active] : "SEO Engine"}</div>
          <div className="topbar-actions">
            <ThemeToggle />
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
