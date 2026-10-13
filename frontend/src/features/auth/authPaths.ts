/**
 * The pages that live inside AuthShell, in order. A higher index counts as
 * "forward", so moving from "/" to "/signup" slides left and the reverse
 * slides right. Add a path here to make it part of the sliding scene.
 */
export const AUTH_PATHS = ["/", "/signup", "/verify"];

/** "/signup/" and "/signup" are the same page. */
export function normalizePath(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}
