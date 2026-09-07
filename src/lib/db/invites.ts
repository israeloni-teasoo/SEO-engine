import { randomBytes } from "crypto";
import { db } from "./client";
import type { Role } from "../auth/session";

export interface InviteRow {
  id: string;
  email: string;
  role: Role;
  token: string;
  invitedBy: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

export async function createInvite(input: {
  email: string;
  role: Role;
  invitedBy: string;
}): Promise<InviteRow> {
  const token = randomBytes(24).toString("hex");
  const rows = await db()<InviteRow[]>`
    INSERT INTO invites (email, role, token, invited_by)
    VALUES (${input.email.toLowerCase()}, ${input.role}, ${token}, ${input.invitedBy})
    RETURNING *`;
  return rows[0];
}

export async function getInviteByToken(token: string): Promise<InviteRow | null> {
  const rows = await db()<InviteRow[]>`SELECT * FROM invites WHERE token = ${token} LIMIT 1`;
  return rows[0] ?? null;
}

/** A pending (unaccepted) invite for an email, if any. */
export async function getPendingInvite(email: string): Promise<InviteRow | null> {
  const rows = await db()<InviteRow[]>`
    SELECT * FROM invites
    WHERE lower(email) = lower(${email}) AND accepted_at IS NULL
    ORDER BY created_at DESC LIMIT 1`;
  return rows[0] ?? null;
}

export async function markInviteAccepted(id: string): Promise<void> {
  await db()`UPDATE invites SET accepted_at = now() WHERE id = ${id}`;
}

export async function listInvites(): Promise<InviteRow[]> {
  return db()<InviteRow[]>`SELECT * FROM invites ORDER BY created_at DESC`;
}

export async function deleteInvite(id: string): Promise<void> {
  await db()`DELETE FROM invites WHERE id = ${id}`;
}
