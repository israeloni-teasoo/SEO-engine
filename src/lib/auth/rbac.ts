import type { Role, SessionUser } from "./session";

const RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 };

/** True if `role` is at least as privileged as `min`. */
export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

export const isAdmin = (u: { role: Role }) => u.role === "admin";
/** Editors and admins may publish directly; authors submit for review. */
export const canPublish = (u: { role: Role }) => atLeast(u.role, "editor");
/** Editors and admins can review/approve authors' submissions. */
export const canReview = (u: { role: Role }) => atLeast(u.role, "editor");

/** Can this user edit this article? Authors only their own; editors+ any. */
export function canEditArticle(user: SessionUser, authorId: string): boolean {
  return atLeast(user.role, "editor") || user.sub === authorId;
}
