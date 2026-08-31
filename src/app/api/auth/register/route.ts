import { NextResponse } from "next/server";
import { getUserByEmail, createUser } from "@/lib/db/users";
import { hashPassword, passwordProblem } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, authConfigured, SESSION_COOKIE } from "@/lib/auth/session";
import { roleForNewUser, emailDomainAllowed } from "@/lib/auth/provision";
import { dbConfigured } from "@/lib/db/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!authConfigured() || !dbConfigured()) {
    return NextResponse.json(
      { error: "Accounts are not enabled. Set AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (!emailDomainAllowed(email)) {
    return NextResponse.json({ error: "That email domain is not allowed to register." }, { status: 403 });
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const role = await roleForNewUser(email);
  const user = await createUser({
    email,
    name: name || email.split("@")[0],
    passwordHash: await hashPassword(password),
    role,
  });

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name ?? "",
    role: user.role,
  });
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
