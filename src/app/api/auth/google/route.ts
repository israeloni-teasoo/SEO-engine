import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAuthUrl, googleConfigured } from "@/lib/auth/google";
import { authConfigured } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!authConfigured() || !googleConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured." },
      { status: 503 },
    );
  }
  const origin = new URL(req.url).origin;
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getAuthUrl(origin, state));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
