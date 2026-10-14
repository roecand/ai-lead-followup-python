/**
 * The pages that live inside AuthShell, in order. A higher index counts as
 * "forward", so moving from "/" to "/signup" slides left and the reverse
 * slides right. Add a path here to make it part of the sliding scene.
 */
export const SECURE_ACCOUNT_PATH = "/secure";

export const AUTH_PATHS = ["/", "/signup", "/verify", SECURE_ACCOUNT_PATH];

/** Pages in the scene that need a signed-in session (the rest need a signed-out one). */
export const SIGNED_IN_AUTH_PATHS = [SECURE_ACCOUNT_PATH];

/** "/signup/" and "/signup" are the same page. */
export function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}
