import { countUsers } from "../db/users";
import type { Role } from "./session";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Optional company-domain restriction for both credential and Google sign-up. */
export function allowedEmailDomain(): string | null {
  return (
    process.env.ALLOWED_EMAIL_DOMAIN ||
    process.env.GOOGLE_ALLOWED_DOMAIN ||
    null
  );
}

export function emailDomainAllowed(email: string): boolean {
  const domain = allowedEmailDomain();
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

/**
 * Role for a newly created account:
 *  - listed in ADMIN_EMAILS -> admin
 *  - the very first user in the system -> admin (bootstrap)
 *  - everyone else -> author (least privilege; an admin can promote them)
 */
export async function roleForNewUser(email: string): Promise<Role> {
  if (adminEmails().includes(email.toLowerCase())) return "admin";
  if ((await countUsers()) === 0) return "admin";
  return "author";
}
