import { useCallback, useEffect, useState, type CSSProperties } from "react";

export type Mode = "system" | "light" | "dark";
export type Radius = "sharp" | "soft" | "round";
export type Density = "comfortable" | "compact";

export interface Theme {
  mode: Mode;
  /** null = the built-in green. Otherwise a #rrggbb hex. */
  accent: string | null;
  radius: Radius;
  density: Density;
}

export const DEFAULT_THEME: Theme = { mode: "system", accent: null, radius: "soft", density: "comfortable" };

export const ACCENTS: { name: string; value: string | null; swatch: string }[] = [
  { name: "Forest", value: null, swatch: "#17613f" },
  { name: "Cobalt", value: "#2b59c3", swatch: "#2b59c3" },
  { name: "Teal", value: "#0f766e", swatch: "#0f766e" },
  { name: "Rose", value: "#be355a", swatch: "#be355a" },
  { name: "Graphite", value: "#3d4743", swatch: "#3d4743" },
];

// Per-browser for now. A company-wide brand color would be stored on the Company row instead.
const KEY = "leadDesk.theme.v1";
const HEX = /^#[0-9a-f]{6}$/i;

function load(): Theme {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_THEME;
    const t = JSON.parse(raw) as Partial<Theme>;
    return {
      mode: ["system", "light", "dark"].includes(t.mode as string) ? (t.mode as Mode) : DEFAULT_THEME.mode,
      accent: typeof t.accent === "string" && HEX.test(t.accent) ? t.accent : null,
      radius: ["sharp", "soft", "round"].includes(t.radius as string) ? (t.radius as Radius) : DEFAULT_THEME.radius,
      density: t.density === "compact" ? "compact" : "comfortable",
    };
  } catch {
    return DEFAULT_THEME;
  }
}

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function luminance(c: number[]) {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text color that reads best on top of the given fill (higher WCAG contrast of white vs near-black). */
function inkFor(c: number[]) {
  const l = luminance(c);
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.06 ? "#ffffff" : "#0e1512";
}

/** Inline CSS variables for a custom accent. In dark mode the accent is lightened so fills and icons stay visible. */
export function themeVars(theme: Theme): CSSProperties {
  if (!theme.accent) return {};
  const base = rgb(theme.accent);
  const light = base.map((v) => v + (255 - v) * 0.38);
  return {
    "--user-accent": theme.accent,
    "--user-ink": inkFor(base),
    "--user-accent-dark": toHex(light),
    "--user-ink-dark": inkFor(light),
  } as CSSProperties;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(theme));
    } catch {
      /* private mode or blocked storage: the theme just won't persist */
    }
  }, [theme]);

  const update = useCallback((patch: Partial<Theme>) => setTheme((t) => ({ ...t, ...patch })), []);
  const reset = useCallback(() => setTheme(DEFAULT_THEME), []);
  return { theme, update, reset };
}
