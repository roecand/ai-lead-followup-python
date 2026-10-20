import { apiFetch } from "../../shared/api/client";

/**
 * Calls for Settings > Team. Every route needs a signed-in session.
 *
 * Backend contract. Change the paths here if yours differ.
 *   GET  /auth/me                      -> 200 { name, email, role }
 *   POST /team/invites { email, role } -> 201 { email, role, expires_at, join_code? }
 *                                         403 not allowed to invite, or not allowed to give that role
 *                                         409 that email already has an account
 *                                         422 bad email or unknown role
 *                                         429 too many invites, try later
 *
 * The backend creates the invite for the inviter's own company and emails it.
 * join_code is optional. When it comes back, the panel also shows a signup
 * link the inviter can copy, which helps if the email lands in spam.
 *
 * The role rules below only decide what the form shows. The backend has to
 * check the same rules on every request, or anyone could skip the form and
 * send their own request.
 */

export type Role = "admin" | "owner" | "staff";

export interface Me {
  name: string;
  email: string;
  role: Role;
}

export interface SentInvite {
  email: string;
  role: Role;
  expires_at: string;
  join_code?: string;
}

/** Which roles each role may hand out. Owners can never create an admin. */
export const ASSIGNABLE: Record<Role, Role[]> = {
  admin: ["staff", "owner", "admin"],
  owner: ["staff", "owner"],
  staff: [],
};

export const ROLE_INFO: Record<Role, { label: string; text: string }> = {
  staff: { label: "Staff", text: "Reads and replies to leads. Can't invite people or change company settings." },
  owner: { label: "Owner", text: "Everything staff can do, plus inviting people and managing company settings." },
  admin: { label: "Admin", text: "Full access across the company. Only an admin can make another admin." },
};

/** A failed call. `status` lets the form word its own message. */
export class TeamError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(status: number, detail?: string) {
    super(detail ?? `Request failed (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new TeamError(res.status, typeof body?.detail === "string" ? body.detail : undefined);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchMe(): Promise<Me> {
  return call<Me>("/auth/me");
}

export function sendInvite(email: string, role: Role): Promise<SentInvite> {
  return call<SentInvite>("/team/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
}

/** Loose on purpose. The backend does the real check. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
