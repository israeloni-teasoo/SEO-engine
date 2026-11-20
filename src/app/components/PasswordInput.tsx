"use client";

import { useState } from "react";

const EyeOpen = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOff = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Password field with a show/hide toggle and an optional Caps-Lock warning.
 * Drop-in replacement for a bare <input type="password">.
 */
export default function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = "current-password",
  onEnter,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  return (
    <>
      <div className="input-affix">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            setCaps(e.getModifierState?.("CapsLock") ?? false);
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") ?? false)}
        />
        <button
          type="button"
          className="input-affix-btn"
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
        >
          {show ? EyeOff : EyeOpen}
        </button>
      </div>
      {caps && <div className="field-warn">⚠ Caps Lock is on</div>}
    </>
  );
}
