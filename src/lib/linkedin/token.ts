import { authConfigured, getSession } from "../auth/session";
import { dbConfigured } from "../db/client";
import { getLinkedInConnection } from "../db/linkedin";
import { getSettings } from "../db/settings";

const multiUser = () => authConfigured() && dbConfigured();

export interface ResolvedLinkedIn {
  accessToken: string;
  name: string | null;
  sub: string | null;
  /** Org id available for company-page posting (from shared settings/env). */
  orgId: string | null;
}

/**
 * Resolve the LinkedIn access token for the current request. In multi-user
 * mode it comes from the signed-in user's stored connection; in single-user
 * mode it comes from the httpOnly cookie.
 */
export async function resolveLinkedIn(req: Request): Promise<ResolvedLinkedIn | null> {
  if (multiUser()) {
    const session = await getSession(req);
    if (!session) return null;
    const conn = await getLinkedInConnection(session.sub);
    if (!conn) return null;
    const settings = await getSettings().catch(() => null);
    return {
      accessToken: conn.accessToken,
      name: conn.name,
      sub: conn.sub,
      orgId: settings?.linkedinOrgId || process.env.LINKEDIN_ORG_ID || null,
    };
  }

  const token = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)li_access_token=([^;]+)/)?.[1];
  if (!token) return null;
  return {
    accessToken: token,
    name: null,
    sub: null,
    orgId: process.env.LINKEDIN_ORG_ID || null,
  };
}
