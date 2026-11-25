import { NextResponse } from "next/server";
import { getUserInfo, isConfigured } from "@/lib/linkedin/client";
import { resolveLinkedIn } from "@/lib/linkedin/token";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const resolved = await resolveLinkedIn(req).catch(() => null);
  if (!resolved) {
    return NextResponse.json({ configured: isConfigured(), connected: false });
  }

  // A valid token means connected. Member identity is only needed for
  // personal-profile posting; a company-page-only app (no openid/profile
  // scope) still connects and can post to its organization.
  let name = resolved.name ?? null;
  let memberUrn = resolved.sub ? `urn:li:person:${resolved.sub}` : null;
  if (!resolved.sub) {
    try {
      const user = await getUserInfo(resolved.accessToken);
      name = user.name ?? name;
      memberUrn = `urn:li:person:${user.sub}`;
    } catch {
      /* org-only app: no identity scope — fine. */
    }
  }

  return NextResponse.json({
    configured: true,
    connected: true,
    name,
    memberUrn,
    orgId: resolved.orgId,
    canPostOrg: Boolean(resolved.orgId),
  });
}
