import { countUsers } from "../db/users";
import { getPendingInvite } from "../db/invites";
import type { Role } from "./session";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Optional company-domain restriction for both credential and Google sign-up. */
export function allowedEmailDomain(): string | null {
  return process.env.ALLOWED_EMAIL_DOMAIN || process.env.GOOGLE_ALLOWED_DOMAIN || null;
}

export function emailDomainAllowed(email: string): boolean {
  const domain = allowedEmailDomain();
  if (!domain) return true;
  return email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);
}

/** Open (self-serve) registration only when explicitly enabled. */
function openRegistration(): boolean {
  return process.env.OPEN_REGISTRATION === "true";
}

export interface RegistrationDecision {
  allowed: boolean;
  role: Role;
  inviteId?: string;
  reason?: string;
}

/**
 * Decide whether an email may create an account and with what role.
 * Order: ADMIN_EMAILS -> first user (bootstrap) -> pending invite -> open reg.
 */
export async function registrationDecision(email: string): Promise<RegistrationDecision> {
  const lower = email.toLowerCase();
  if (adminEmails().includes(lower)) return { allowed: true, role: "admin" };
  if ((await countUsers()) === 0) return { allowed: true, role: "admin" };

  const invite = await getPendingInvite(lower);
  if (invite) return { allowed: true, role: invite.role, inviteId: invite.id };

  if (openRegistration()) return { allowed: true, role: "author" };
  return { allowed: false, role: "author", reason: "This app is invite-only. Ask an admin to add your email." };
}
