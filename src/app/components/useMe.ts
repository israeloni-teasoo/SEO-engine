"use client";

import { useEffect, useState } from "react";

export type Role = "admin" | "editor" | "author";

export interface Me {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  image?: string | null;
}

export interface MeState {
  loading: boolean;
  authEnabled: boolean;
  me: Me | null;
}

/** Fetch the current user (or single-user mode) from /api/auth/me. */
export function useMe(): MeState {
  const [state, setState] = useState<MeState>({
    loading: true,
    authEnabled: false,
    me: null,
  });

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (active) setState({ loading: false, authEnabled: Boolean(d.authEnabled), me: d.user ?? null });
      })
      .catch(() => {
        if (active) setState({ loading: false, authEnabled: false, me: null });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export const canPublishRole = (role?: Role) => role === "admin" || role === "editor";
export const canReviewRole = (role?: Role) => role === "admin" || role === "editor";
export const isAdminRole = (role?: Role) => role === "admin";
