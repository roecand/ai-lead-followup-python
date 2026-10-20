import { apiFetch } from "../../shared/api/client";

/**
 * Calls for two-step sign-in. Every route needs a signed-in session.
 *
 * Backend contract. Change the paths here if yours differ.
 *   GET  /auth/2fa                      -> 200 { method: "none" | "email" | "totp" }
 *   POST /auth/2fa/totp/start           -> 200 { secret, otpauth_uri }
 *                                          409 an authenticator is already on
 *   POST /auth/2fa/totp/confirm {code}  -> 200 { recovery_codes: string[] }
 *                                          400 wrong code
 *                                          410 setup expired, call start again
 *                                          429 too many tries
 *   POST /auth/2fa/totp/disable {code}  -> 204, code is a current app code or a recovery code
 *                                          400 wrong code
 *                                          429 too many tries
 *
 * Start only creates a pending secret. Nothing changes for the account until
 * confirm succeeds, so leaving halfway is safe.
 */

export type TwoFactorMethod = "none" | "email" | "totp";

export interface TotpStart {
  /** Base32 key, shown for people who can't scan the QR code. */
  secret: string;
  /** otpauth://totp/... link the QR code is drawn from. */
  otpauth_uri: string;
}

/** A failed call. `status` lets each screen word its own message. */
export class TwoFactorError extends Error {
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
    throw new TwoFactorError(res.status, typeof body?.detail === "string" ? body.detail : undefined);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return call<T>(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function fetchTwoFactorMethod(): Promise<TwoFactorMethod> {
  const data = await call<{ method: TwoFactorMethod }>("/auth/2fa");
  return data.method;
}

export function startTotp(): Promise<TotpStart> {
  return post<TotpStart>("/auth/2fa/totp/start");
}

export async function confirmTotp(code: string): Promise<string[]> {
  const data = await post<{ recovery_codes: string[] }>("/auth/2fa/totp/confirm", { code });
  return data.recovery_codes;
}

export function disableTotp(code: string): Promise<void> {
  return post<void>("/auth/2fa/totp/disable", { code });
}

/** "JBSWY3DPEHPK3PXP" -> "JBSW Y3DP EHPK 3PXP", easier to type by hand. */
export function groupKey(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})(?=.)/g, "$1 ");
}

/** True if the browser let us write to the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
