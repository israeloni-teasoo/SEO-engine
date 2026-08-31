import { NextResponse } from "next/server";
import { getSession, type Role, type SessionUser } from "./session";
import { atLeast } from "./rbac";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Resolve the current session or throw AuthError(401). */
export async function requireUser(req: Request): Promise<SessionUser> {
  const user = await getSession(req);
  if (!user) throw new AuthError("Authentication required.", 401);
  return user;
}

/** Resolve the current session and require at least `min` role, else throw. */
export async function requireRole(req: Request, min: Role): Promise<SessionUser> {
  const user = await requireUser(req);
  if (!atLeast(user.role, min)) {
    throw new AuthError("You don't have permission to do that.", 403);
  }
  return user;
}

/** Turn an AuthError (or any error) into a JSON response. */
export function authErrorResponse(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return NextResponse.json({ error: (e as Error).message }, { status: 500 });
}
