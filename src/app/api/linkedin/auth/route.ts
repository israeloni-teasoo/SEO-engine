import { NextResponse } from "next/server";
import { getAuthUrl, isConfigured } from "@/lib/linkedin/client";
import { randomBytes } from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "LinkedIn is not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET." },
      { status: 503 },
    );
  }
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthUrl(origin, state));
  // CSRF protection: verify this same value on callback.
  res.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
