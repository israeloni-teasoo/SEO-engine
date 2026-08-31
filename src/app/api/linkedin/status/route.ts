import { NextResponse } from "next/server";
import { getUserInfo, isConfigured } from "@/lib/linkedin/client";

export const runtime = "nodejs";

function tokenFrom(req: Request): string | null {
  return (
    req.headers.get("cookie")?.match(/(?:^|;\s*)li_access_token=([^;]+)/)?.[1] ?? null
  );
}

export async function GET(req: Request) {
  const token = tokenFrom(req);
  if (!token) {
    return NextResponse.json({ configured: isConfigured(), connected: false });
  }
  try {
    const user = await getUserInfo(token);
    return NextResponse.json({
      configured: true,
      connected: true,
      name: user.name ?? null,
      memberUrn: `urn:li:person:${user.sub}`,
      orgId: process.env.LINKEDIN_ORG_ID ?? null,
    });
  } catch {
    // Token expired or revoked.
    return NextResponse.json({ configured: isConfigured(), connected: false });
  }
}
