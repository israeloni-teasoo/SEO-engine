import { NextResponse } from "next/server";
import { testConnection, bridgeStatus, WordPressError } from "@/lib/wordpress/client";
import type { WordPressCredentials } from "@/lib/wordpress/client";

export const runtime = "nodejs";

function credsFrom(body: Partial<WordPressCredentials>): WordPressCredentials {
  return {
    url: body.url || process.env.WORDPRESS_URL || "",
    username: body.username || process.env.WORDPRESS_USERNAME || "",
    applicationPassword:
      body.applicationPassword || process.env.WORDPRESS_APP_PASSWORD || "",
  };
}

export async function POST(req: Request) {
  let body: Partial<WordPressCredentials> = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body -> fall back to env */
  }
  const creds = credsFrom(body);
  if (!creds.url || !creds.username || !creds.applicationPassword) {
    return NextResponse.json(
      { error: "Missing WordPress URL, username, or application password." },
      { status: 400 },
    );
  }
  try {
    const user = await testConnection(creds);
    const bridge = await bridgeStatus(creds);
    return NextResponse.json({ ok: true, user, bridge });
  } catch (e) {
    const status = e instanceof WordPressError ? e.status || 502 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
