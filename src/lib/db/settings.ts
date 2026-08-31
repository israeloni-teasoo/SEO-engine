import { db } from "./client";
import { encrypt, decrypt } from "../crypto";

export interface AppSettings {
  wordpressUrl: string | null;
  wordpressUsername: string | null;
  wordpressAppPasswordEnc: string | null;
  linkedinOrgId: string | null;
  siteDomain: string | null;
  updatedAt: Date;
}

export async function getSettings(): Promise<AppSettings | null> {
  const rows = await db()<AppSettings[]>`SELECT * FROM app_settings WHERE id = 1`;
  return rows[0] ?? null;
}

export interface WordPressConfig {
  url: string;
  username: string;
  applicationPassword: string;
}

/** Return the shared WordPress credentials with the app password decrypted. */
export async function getWordPressConfig(): Promise<WordPressConfig | null> {
  const s = await getSettings();
  if (!s?.wordpressUrl || !s.wordpressUsername || !s.wordpressAppPasswordEnc) {
    return null;
  }
  return {
    url: s.wordpressUrl,
    username: s.wordpressUsername,
    applicationPassword: decrypt(s.wordpressAppPasswordEnc),
  };
}

export async function updateSettings(input: {
  wordpressUrl?: string;
  wordpressUsername?: string;
  wordpressAppPassword?: string; // plaintext; encrypted here. "" clears.
  linkedinOrgId?: string;
  siteDomain?: string;
}): Promise<void> {
  const encPassword =
    input.wordpressAppPassword === undefined
      ? undefined
      : input.wordpressAppPassword
        ? encrypt(input.wordpressAppPassword)
        : null;

  await db()`
    UPDATE app_settings SET
      wordpress_url = COALESCE(${input.wordpressUrl ?? null}, wordpress_url),
      wordpress_username = COALESCE(${input.wordpressUsername ?? null}, wordpress_username),
      wordpress_app_password_enc = ${
        encPassword === undefined ? db()`wordpress_app_password_enc` : encPassword
      },
      linkedin_org_id = COALESCE(${input.linkedinOrgId ?? null}, linkedin_org_id),
      site_domain = COALESCE(${input.siteDomain ?? null}, site_domain),
      updated_at = now()
    WHERE id = 1`;
}
