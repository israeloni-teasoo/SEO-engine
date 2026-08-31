import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/db/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, sessionCookieOptions, authConfigured, SESSION_COOKIE } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!authConfigured() || !dbConfigured()) {
    return NextResponse.json(
      { error: "Accounts are not enabled. Set AUTH_SECRET and DATABASE_URL." },
      { status: 503 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const user = await getUserByEmail(email);
  // Uniform error to avoid leaking which emails exist.
  const invalid = () =>
    NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });

  if (!user || !user.passwordHash) return invalid();
  if (user.status === "disabled") {
    return NextResponse.json({ error: "This account has been disabled." }, { status: 403 });
  }
  if (!(await verifyPassword(password, user.passwordHash))) return invalid();

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
