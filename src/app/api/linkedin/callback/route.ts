import { NextResponse } from "next/server";
import { exchangeCode } from "@/lib/linkedin/client";

export const runtime = "nodejs";

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

  if (error) {
    return back(`linkedin=error&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !state || !cookieState || state !== cookieState) {
    return back("linkedin=error&reason=invalid_state");
  }

  try {
    const token = await exchangeCode(code, origin);
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
