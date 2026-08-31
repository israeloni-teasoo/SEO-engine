"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "../components/AppHeader";
import { useMe, isAdminRole, type Role } from "../components/useMe";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: "active" | "disabled";
  createdAt: string;
}

interface Settings {
  wordpressUrl: string;
  wordpressUsername: string;
  wordpressPasswordSet: boolean;
  linkedinOrgId: string;
  siteDomain: string;
}

export default function AdminPage() {
  const { me, authEnabled, loading } = useMe();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [encReady, setEncReady] = useState(true);
  const [wpPassword, setWpPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const loadUsers = useCallback(async () => {
    const r = await fetch("/api/admin/users");
    if (r.ok) setUsers((await r.json()).users);
  }, []);

  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/admin/settings");
    if (r.ok) {
      const d = await r.json();
      setSettings(d.settings);
      setEncReady(d.encryptionConfigured);
    }
  }, []);

  useEffect(() => {
    if (me && isAdminRole(me.role)) {
      loadUsers();
      loadSettings();
    }
  }, [me, loadUsers, loadSettings]);

  async function changeUser(id: string, patch: { role?: Role; status?: "active" | "disabled" }) {
    setMsg(null);
    const r = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      setMsg({ kind: "error", text: (await r.json()).error });
    } else {
      loadUsers();
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setMsg(null);
    const body: Record<string, string> = {
      wordpressUrl: settings.wordpressUrl,
      wordpressUsername: settings.wordpressUsername,
      linkedinOrgId: settings.linkedinOrgId,
      siteDomain: settings.siteDomain,
    };
    if (wpPassword) body.wordpressAppPassword = wpPassword;
    const r = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) setMsg({ kind: "error", text: (await r.json()).error });
    else {
      setMsg({ kind: "success", text: "Settings saved." });
      setWpPassword("");
      loadSettings();
    }
  }

  if (loading) return null;
  if (!authEnabled) {
    return (
      <>
        <AppHeader me={me} authEnabled={authEnabled} active="admin" />
        <div className="page"><div className="banner info">Accounts are not enabled on this deployment.</div></div>
      </>
    );
  }
  if (!me || !isAdminRole(me.role)) {
    return (
      <>
        <AppHeader me={me} authEnabled={authEnabled} active="admin" />
        <div className="page"><div className="banner error">Admins only.</div></div>
      </>
    );
  }

  return (
    <>
      <AppHeader me={me} authEnabled={authEnabled} active="admin" />
      <div className="page">
        {msg && <div className={`banner ${msg.kind}`}>{msg.text}</div>}

        <div className="card">
          <div className="card-header">Team members</div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name || "—"}{u.id === me.id ? " (you)" : ""}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.role} onChange={(e) => changeUser(u.id, { role: e.target.value as Role })}>
                        <option value="admin">admin</option>
                        <option value="editor">editor</option>
                        <option value="author">author</option>
                      </select>
                    </td>
                    <td>
                      <select value={u.status} onChange={(e) => changeUser(u.id, { status: e.target.value as "active" | "disabled" })}>
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Shared WordPress connection</div>
          <div className="card-body">
            {!encReady && (
              <div className="banner error">Set the ENCRYPTION_KEY env var before saving credentials.</div>
            )}
            <div className="hint" style={{ marginBottom: 12 }}>
              Configured once here and used by every staff member who publishes. The app password is encrypted at rest.
            </div>
            {settings && (
              <>
                <div className="row">
                  <div className="field" style={{ marginTop: 0 }}>
                    <label>Site URL</label>
                    <input type="text" value={settings.wordpressUrl} placeholder="https://blog.example.com" onChange={(e) => setSettings({ ...settings, wordpressUrl: e.target.value })} />
                  </div>
                  <div className="field" style={{ marginTop: 0 }}>
                    <label>Username</label>
                    <input type="text" value={settings.wordpressUsername} onChange={(e) => setSettings({ ...settings, wordpressUsername: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Application Password {settings.wordpressPasswordSet && <span className="counter">saved ✓</span>}</label>
                  <input type="text" value={wpPassword} placeholder={settings.wordpressPasswordSet ? "•••• (leave blank to keep)" : "xxxx xxxx xxxx xxxx"} onChange={(e) => setWpPassword(e.target.value)} />
                </div>
                <div className="row">
                  <div className="field">
                    <label>Site domain (for internal-link analysis)</label>
                    <input type="text" value={settings.siteDomain} placeholder="example.com" onChange={(e) => setSettings({ ...settings, siteDomain: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>LinkedIn company page ID</label>
                    <input type="text" value={settings.linkedinOrgId} placeholder="1234567" onChange={(e) => setSettings({ ...settings, linkedinOrgId: e.target.value })} />
                  </div>
                </div>
                <div className="btn-row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                  <button className="btn primary" onClick={saveSettings} disabled={!encReady}>Save settings</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
