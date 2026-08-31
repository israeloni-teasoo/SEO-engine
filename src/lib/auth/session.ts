import { SignJWT, jwtVerify } from "jose";

// Signed-JWT sessions stored in an httpOnly cookie. Verification uses `jose`,
// which runs on the Edge runtime, so middleware can gate routes without a DB
// call. The DB is only touched in Node-runtime route handlers.

export const SESSION_COOKIE = "seo_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type Role = "admin" | "editor" | "author";

export interface SessionUser {
  sub: string; // user id
  email: string;
  name: string;
  role: Role;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set — required to sign sessions.");
  return new TextEncoder().encode(s);
}

export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: (payload.role as Role) ?? "author",
    };
  } catch {
    return null;
  }
}

/** Read + verify the session from a request's Cookie header. */
export async function getSession(req: Request): Promise<SessionUser | null> {
  const token = req.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!token) return null;
  return verifySessionToken(decodeURIComponent(token));
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
