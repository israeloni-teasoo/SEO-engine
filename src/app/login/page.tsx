"use client";

import { Suspense, useEffect, useState } from "react";
import { postJson } from "../components/api";
import PasswordInput from "../components/PasswordInput";

export const dynamic = "force-dynamic";

function LoginInner() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleOn, setGoogleOn] = useState(false);
  const [invite, setInvite] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const err = p.get("error");
    if (err) setError(`Sign-in failed: ${err.replace(/_/g, " ")}`);
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((d) => setGoogleOn(Boolean(d.google)))
      .catch(() => setGoogleOn(false));

    const token = p.get("invite");
    if (token) {
      fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.valid) {
            setInvite({ email: d.email, role: d.role });
            setEmail(d.email);
            setMode("register");
          }
        })
        .catch(() => {});
    }
  }, []);

  function nextUrl(): string {
    const p = new URLSearchParams(window.location.search);
    return p.get("next") || "/";
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await postJson(`/api/auth/${mode}`, { email, password, name });
      if (!ok) {
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

  const canSubmit = email.trim() && password.trim() && (mode === "login" || !invite ? true : true);

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" />
              <line x1="20" y1="20" x2="15.5" y2="15.5" />
            </svg>
          </span>
          <div>
            <div className="auth-title">SEO Engine</div>
            <div className="auth-sub">Blog Post Optimizer</div>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(null); }}>
            Sign in
          </button>
          <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(null); }} disabled={!!invite && false}>
            Register
          </button>
        </div>

        {invite && <div className="banner success" style={{ marginBottom: 14 }}>You&apos;ve been invited as <strong>{invite.role}</strong> &middot; {invite.email}</div>}
        {error && <div className="banner error" style={{ marginBottom: 14 }}>{error}</div>}

        {mode === "register" && (
          <div className="field" style={{ marginTop: 0 }}>
            <label htmlFor="name">Full name</label>
            <input id="name" type="text" value={name} placeholder="Jane Doe" onChange={(e) => setName(e.target.value)} />
          </div>
        )}

        <div className="field" style={{ marginTop: mode === "register" ? undefined : 0 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} placeholder="you@teasooconsulting.com" autoComplete="email" readOnly={!!invite} onChange={(e) => setEmail(e.target.value)} />
          {invite && <div className="hint">This email is tied to your invitation.</div>}
        </div>

        <div className="field">
          <label htmlFor="password">
            Password
            {mode === "register" && <span className="counter">min 8 characters</span>}
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder={mode === "register" ? "Create a password" : "Your password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onEnter={submit}
          />
        </div>

        <button className="btn primary btn-lg btn-block" onClick={submit} disabled={busy || !canSubmit} style={{ marginTop: 6 }}>
          {busy && <span className="spinner" />} {mode === "login" ? "Sign in" : "Create account"}
        </button>

        {googleOn && (
          <>
            <div className="divider">or</div>
            <a className="btn google btn-lg btn-block" href="/api/auth/google">
              <GoogleMark /> Continue with Google
            </a>
          </>
        )}

        <div className="auth-foot">
          {mode === "login" ? (
            <>New here? <button className="linklike" onClick={() => { setMode("register"); setError(null); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button className="linklike" onClick={() => { setMode("login"); setError(null); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
