import { useSyncExternalStore } from "react";

/**
 * Light / dark / auto, saved per device in localStorage.
 *
 * It's a tiny module-level store instead of plain useState so the header
 * toggle and the Settings > Appearance control stay in sync when both are on
 * screen. The colors themselves live in src/index.css.
 *
 * If you later want this per user instead of per device, store the mode on
 * the User row and call setThemeMode() with it after login.
 */

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "gs.theme"; // index.html reads the same key before first paint

const listeners = new Set<() => void>();
const media = window.matchMedia("(prefers-color-scheme: dark)");

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

let mode: ThemeMode = read();

function apply() {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

function emit() {
  listeners.forEach((fn) => fn());
}

apply();
media.addEventListener("change", emit);

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try {
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    /* private mode or blocked storage. It still applies, it just won't persist. */
  }
  apply();
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const snapshot = () => `${mode}|${media.matches ? "dark" : "light"}`;

export function useTheme() {
  const [m, system] = useSyncExternalStore(subscribe, snapshot).split("|") as [ThemeMode, ResolvedTheme];
  const resolved: ResolvedTheme = m === "system" ? system : m;
  return { mode: m, resolved, setMode: setThemeMode };
}
