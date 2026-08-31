"use client";

import { Suspense, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

function LoginInner() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleOn, setGoogleOn] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const err = p.get("error");
    if (err) setError(`Sign-in failed: ${err.replace(/_/g, " ")}`);
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((d) => setGoogleOn(Boolean(d.google)))
      .catch(() => setGoogleOn(false));
  }, []);

  function nextUrl(): string {
    const p = new URLSearchParams(window.location.search);
    return p.get("next") || "/";
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      window.location.href = nextUrl();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>🔍 SEO Engine</h1>
        <div className="hint" style={{ marginBottom: 18 }}>
          {mode === "login" ? "Sign in to continue." : "Create your account."}
        </div>

        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Sign in
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        {error && <div className="banner error">{error}</div>}

        {mode === "register" && (
          <div className="field" style={{ marginTop: 0 }}>
            <label>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Email</label>
          <input type="text" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <button className="btn primary" style={{ width: "100%", marginTop: 8, justifyContent: "center", display: "flex" }} onClick={submit} disabled={busy}>
          {busy && <span className="spinner" />} {mode === "login" ? "Sign in" : "Create account"}
        </button>

        {googleOn && (
          <>
            <div className="divider">or</div>
            <a className="btn google" href="/api/auth/google">
              Continue with Google
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
