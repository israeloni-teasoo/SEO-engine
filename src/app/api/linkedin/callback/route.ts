import { NextResponse } from "next/server";
import { exchangeCode, getUserInfo } from "@/lib/linkedin/client";
import { authConfigured, getSession } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { saveLinkedInConnection } from "@/lib/db/linkedin";

export const runtime = "nodejs";

const multiUser = () => authConfigured() && dbConfigured();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const cookieState = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)li_oauth_state=([^;]+)/)?.[1];

  const back = (params: string) => NextResponse.redirect(`${origin}/?${params}`);

  if (error) return back(`linkedin=error&reason=${encodeURIComponent(error)}`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("linkedin=error&reason=invalid_state");
  }

  try {
    const token = await exchangeCode(code, origin);

    if (multiUser()) {
      // Store the token against the signed-in user.
      const session = await getSession(req);
      if (!session) return back("linkedin=error&reason=not_signed_in");
      let sub: string | undefined;
      let name: string | undefined;
      try {
        const profile = await getUserInfo(token.access_token);
        sub = profile.sub;
        name = profile.name;
      } catch {
        /* identity fetch is best-effort */
      }
      await saveLinkedInConnection(session.sub, {
        accessToken: token.access_token,
        expiresInSeconds: token.expires_in,
        sub,
        name,
      });
      const res = back("linkedin=connected");
      res.cookies.set("li_oauth_state", "", { path: "/", maxAge: 0 });
      return res;
    }

    // Single-user: keep the token in an httpOnly cookie.
    const res = back("linkedin=connected");
    res.cookies.set("li_access_token", token.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: token.expires_in,
    });
    res.cookies.set("li_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return back(`linkedin=error&reason=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
}
