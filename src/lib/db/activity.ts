import { db } from "./client";

export type ActivityAction =
  | "created"
  | "updated"
  | "submitted"
  | "published"
  | "status_changed"
  | "deleted_wp"
  | "invited"
  | "role_changed";

export interface ActivityRow {
  id: string;
  userId: string | null;
  action: ActivityAction;
  articleId: string | null;
  detail: string;
  createdAt: Date;
}

export interface ActivityWithNames extends ActivityRow {
  userName: string | null;
  userEmail: string | null;
  articleTitle: string | null;
}

/** Best-effort activity log — never throws into the caller's flow. */
export async function logActivity(input: {
  userId: string | null;
  action: ActivityAction;
  articleId?: string | null;
  detail?: string;
}): Promise<void> {
  try {
    await db()`
      INSERT INTO activity (user_id, action, article_id, detail)
      VALUES (${input.userId}, ${input.action}, ${input.articleId ?? null}, ${input.detail ?? ""})`;
  } catch {
    /* logging must not break the main action */
  }
}

export async function listActivity(limit = 100): Promise<ActivityWithNames[]> {
  return db()<ActivityWithNames[]>`
    SELECT a.*, u.name AS user_name, u.email AS user_email, ar.title AS article_title
    FROM activity a
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN articles ar ON ar.id = a.article_id
    ORDER BY a.created_at DESC
    LIMIT ${limit}`;
}
