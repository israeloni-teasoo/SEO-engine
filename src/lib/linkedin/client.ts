// LinkedIn integration using OAuth 2.0 + the Posts API (/rest/posts), which
// replaced the deprecated Shares/UGC APIs in 2024.
//
// Scopes:
//   - Personal profile posting: `w_member_social` (+ `openid profile` to identify the member)
//   - Company page posting:      `w_organization_social` (requires Marketing/Community
//                                Management API approval — a review process)
//
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

const AUTH_BASE = "https://www.linkedin.com/oauth/v2";
const API_BASE = "https://api.linkedin.com";

/** LinkedIn API version header in YYYYMM form. Override with LINKEDIN_API_VERSION. */
export function apiVersion(): string {
  return process.env.LINKEDIN_API_VERSION || "202508";
}

export function isConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export function redirectUri(origin: string): string {
  return process.env.LINKEDIN_REDIRECT_URI || `${origin}/api/linkedin/callback`;
}

/** Default scopes; org posting also needs w_organization_social (approved app). */
export function scopes(): string {
  return (
    process.env.LINKEDIN_SCOPES ||
    "openid profile w_member_social"
  );
}

export function getAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID as string,
    redirect_uri: redirectUri(origin),
    state,
    scope: scopes(),
  });
  return `${AUTH_BASE}/authorization?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
}

export async function exchangeCode(
  code: string,
  origin: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    client_id: process.env.LINKEDIN_CLIENT_ID as string,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET as string,
  });
  const res = await fetch(`${AUTH_BASE}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as TokenResponse;
}

export interface LinkedInUser {
  sub: string;
  name?: string;
  email?: string;
}

/** OpenID userinfo — returns the member id (`sub`) used to build the author URN. */
export async function getUserInfo(accessToken: string): Promise<LinkedInUser> {
  const res = await fetch(`${API_BASE}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch LinkedIn profile (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as LinkedInUser;
}

export interface CreatePostArgs {
  accessToken: string;
  /** Full author URN, e.g. "urn:li:person:abc" or "urn:li:organization:123". */
  authorUrn: string;
  /** Post text. LinkedIn posts are plain text (links auto-unfurl). */
  commentary: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
}

/**
 * Create a LinkedIn post. Returns the created post URN (x-restli-id header).
 * Certain reserved characters in commentary must be escaped per LinkedIn's spec.
 */
export async function createPost(args: CreatePostArgs): Promise<{ id: string; url: string }> {
  const payload = {
    author: args.authorUrn,
    commentary: escapeCommentary(args.commentary),
    visibility: args.visibility ?? "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(`${API_BASE}/rest/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": apiVersion(),
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(payload),
  });

  if (res.status !== 201 && !res.ok) {
    throw new Error(`LinkedIn post failed (${res.status}): ${await res.text()}`);
  }
  const id = res.headers.get("x-restli-id") || "";
  return {
    id,
    url: id ? `https://www.linkedin.com/feed/update/${id}/` : "",
  };
}

/** LinkedIn requires these characters escaped with a backslash in `commentary`. */
function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (m) => `\\${m}`);
}
