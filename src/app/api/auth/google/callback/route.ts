import { NextResponse } from "next/server";
import { exchangeCode, getProfile } from "@/lib/auth/google";
import { getUserByEmail, createUser, updateProfile } from "@/lib/db/users";
import { roleForNewUser, emailDomainAllowed } from "@/lib/auth/provision";
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1];

  const back = (params: string) => NextResponse.redirect(`${origin}/login?${params}`);

  if (!code || !state || !cookieState || state !== cookieState) {
    return back("error=invalid_state");
  }

  try {
    const accessToken = await exchangeCode(code, origin);
    const profile = await getProfile(accessToken);
    const email = (profile.email ?? "").toLowerCase();
    if (!email || profile.email_verified === false) {
      return back("error=unverified_email");
    }
    if (!emailDomainAllowed(email)) {
      return back("error=domain_not_allowed");
    }

    let user = await getUserByEmail(email);
    if (!user) {
      user = await createUser({
        email,
        name: profile.name ?? email.split("@")[0],
        role: await roleForNewUser(email),
        image: profile.picture ?? null,
      });
    } else {
      if (user.status === "disabled") return back("error=account_disabled");
      await updateProfile(user.id, { name: profile.name, image: profile.picture });
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? profile.name ?? "",
      role: user.role,
    });
    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return back(`error=${encodeURIComponent((e as Error).message.slice(0, 100))}`);
  }
}
