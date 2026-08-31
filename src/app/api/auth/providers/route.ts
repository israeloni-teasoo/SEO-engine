import { NextResponse } from "next/server";
import { authConfigured } from "@/lib/auth/session";
import { googleConfigured } from "@/lib/auth/google";
import { dbConfigured } from "@/lib/db/client";

export const runtime = "nodejs";

// Public: lets the login page know which sign-in options to show.
export async function GET() {
  return NextResponse.json({
    accountsEnabled: authConfigured() && dbConfigured(),
    google: authConfigured() && googleConfigured(),
    credentials: true,
  });
}
