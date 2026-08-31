import { db } from "./client";
import type { Role } from "../auth/session";

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: Role;
  status: "active" | "disabled";
  image: string | null;
  createdAt: Date;
}

export async function countUsers(): Promise<number> {
  const rows = await db()<{ count: string }[]>`SELECT count(*)::int AS count FROM users`;
  return Number(rows[0]?.count ?? 0);
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await db()<UserRow[]>`
    SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1`;
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db()<UserRow[]>`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  name?: string;
  passwordHash?: string | null;
  role: Role;
  image?: string | null;
}): Promise<UserRow> {
  const rows = await db()<UserRow[]>`
    INSERT INTO users (email, name, password_hash, role, image)
    VALUES (${input.email}, ${input.name ?? null}, ${input.passwordHash ?? null},
            ${input.role}, ${input.image ?? null})
    RETURNING *`;
  return rows[0];
}

export async function listUsers(): Promise<UserRow[]> {
  return db()<UserRow[]>`SELECT * FROM users ORDER BY created_at ASC`;
}

export async function setUserRole(id: string, role: Role): Promise<void> {
  await db()`UPDATE users SET role = ${role} WHERE id = ${id}`;
}

export async function setUserStatus(id: string, status: "active" | "disabled"): Promise<void> {
  await db()`UPDATE users SET status = ${status} WHERE id = ${id}`;
}

/** Attach or refresh the profile fields from a Google sign-in. */
export async function updateProfile(
  id: string,
  fields: { name?: string | null; image?: string | null },
): Promise<void> {
  await db()`
    UPDATE users
    SET name = COALESCE(${fields.name ?? null}, name),
        image = COALESCE(${fields.image ?? null}, image)
    WHERE id = ${id}`;
}
