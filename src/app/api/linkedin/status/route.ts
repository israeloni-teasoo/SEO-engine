import { NextResponse } from "next/server";
import { getUserInfo, isConfigured } from "@/lib/linkedin/client";
import { resolveLinkedIn } from "@/lib/linkedin/token";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const resolved = await resolveLinkedIn(req).catch(() => null);
  if (!resolved) {
    return NextResponse.json({ configured: isConfigured(), connected: false });
  }
  try {
    // Confirm the token still works and get the member URN.
    const user = resolved.sub
      ? { sub: resolved.sub, name: resolved.name ?? undefined }
      : await getUserInfo(resolved.accessToken);
    return NextResponse.json({
      configured: true,
      connected: true,
      name: user.name ?? resolved.name ?? null,
      memberUrn: `urn:li:person:${user.sub}`,
      orgId: resolved.orgId,
    });
  } catch {
    return NextResponse.json({ configured: isConfigured(), connected: false });
  }
}
