import { useSyncExternalStore } from "react";

/**
 * Which theme the app uses, saved per device in localStorage.
 *
 * It's a tiny module-level store instead of plain useState so the header's
 * Appearance menu and the Settings > Appearance panel stay in sync when both
 * are on screen. The colors themselves live in src/index.css, one block per
 * theme.
 *
 * If you later want this per user instead of per device, store the mode on
 * the User row and call setThemeMode() with it after login.
 */

export type ThemeMode = "system" | "light" | "original" | "slate" | "desert" | "graphite";
export type ResolvedTheme = "light" | "dark";

export interface ThemeOption {
  value: ThemeMode;
  label: string;
  note: string;
  /** Page background, panel, accent. Drawn as the little preview chip. */
  swatch: [string, string, string];
}

/** Order here is the order in the menus. */
export const THEMES: ThemeOption[] = [
  { value: "system", label: "Auto", note: "Follows your device", swatch: ["#F5F4EF", "#0F1311", "#5EC994"] },
  { value: "light", label: "Light", note: "Warm paper", swatch: ["#F5F4EF", "#FDFCF9", "#1E5138"] },
  { value: "original", label: "Forest", note: "Green black", swatch: ["#0F1311", "#161B18", "#5EC994"] },
  { value: "slate", label: "Slate", note: "Cool blue grey", swatch: ["#12161C", "#181E26", "#84C8A8"] },
  { value: "desert", label: "Desert", note: "Warm charcoal", swatch: ["#171411", "#1F1B17", "#8CC5A2"] },
  { value: "graphite", label: "Graphite", note: "Neutral grey", swatch: ["#151515", "#1C1C1D", "#86C6A0"] },
];

const KEY = "gs.theme"; // index.html reads the same key before first paint
const VALID = new Set<ThemeMode>(THEMES.map((t) => t.value));

const listeners = new Set<() => void>();
const media = window.matchMedia("(prefers-color-scheme: dark)");

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "dark") return "original"; // saved before there were several dark themes
    return v && VALID.has(v as ThemeMode) ? (v as ThemeMode) : "system";
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
  const resolved: ResolvedTheme = m === "system" ? system : m === "light" ? "light" : "dark";
  return { mode: m, resolved, setMode: setThemeMode };
}