import { db } from "./client";
import { encrypt, decrypt } from "../crypto";

interface ConnRow {
  userId: string;
  accessTokenEnc: string;
  expiresAt: Date | null;
  liSub: string | null;
  liName: string | null;
  createdAt: Date;
}

export interface LinkedInConnection {
  accessToken: string;
  expiresAt: Date | null;
  name: string | null;
  sub: string | null;
}

export async function saveLinkedInConnection(
  userId: string,
  input: { accessToken: string; expiresInSeconds?: number; sub?: string; name?: string },
): Promise<void> {
  const enc = encrypt(input.accessToken);
  const expiresAt = input.expiresInSeconds
    ? new Date(Date.now() + input.expiresInSeconds * 1000)
    : null;
  await db()`
    INSERT INTO linkedin_connections (user_id, access_token_enc, expires_at, li_sub, li_name)
    VALUES (${userId}, ${enc}, ${expiresAt}, ${input.sub ?? null}, ${input.name ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      access_token_enc = EXCLUDED.access_token_enc,
      expires_at = EXCLUDED.expires_at,
      li_sub = EXCLUDED.li_sub,
      li_name = EXCLUDED.li_name`;
}

export async function getLinkedInConnection(
  userId: string,
): Promise<LinkedInConnection | null> {
  const rows = await db()<ConnRow[]>`
    SELECT * FROM linkedin_connections WHERE user_id = ${userId} LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null; // expired
  return {
    accessToken: decrypt(row.accessTokenEnc),
    expiresAt: row.expiresAt,
    name: row.liName,
    sub: row.liSub,
  };
}

export async function deleteLinkedInConnection(userId: string): Promise<void> {
  await db()`DELETE FROM linkedin_connections WHERE user_id = ${userId}`;
}
