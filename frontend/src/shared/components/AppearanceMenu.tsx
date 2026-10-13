import { useEffect, useId, useRef, useState } from "react";
import { THEMES, useTheme } from "../hooks/useTheme";

/**
 * The list of themes as a radio group. Used inside the header dropdown and on
 * Settings > Appearance, so both always offer the same choices.
 * Styles live in lib/theme.ts under "appearance".
 */
export function ThemeChoices({ onPicked }: { onPicked?: () => void }) {
  const { mode, setMode } = useTheme();
  const name = useId();

  return (
    <fieldset className="gs-themes">
      <legend className="gs-sr">Theme</legend>
      {THEMES.map((t) => {
        const [bg, card, accent] = t.swatch;
        return (
          <label key={t.value} className={"gs-theme" + (mode === t.value ? " is-on" : "")}>
            <input
              type="radio"
              name={name}
              checked={mode === t.value}
              onChange={() => {
                setMode(t.value);
                onPicked?.();
              }}
            />
            <span
              className={"gs-theme-chip" + (t.value === "system" ? " is-split" : "")}
              style={{ background: bg, ["--chip-card" as string]: card }}
              aria-hidden="true"
            >
              <span className="gs-theme-chip-card" />
              <span className="gs-theme-chip-dot" style={{ background: accent }} />
            </span>
            <span className="gs-theme-text">
              <span className="gs-theme-label">{t.label}</span>
              <span className="gs-theme-note">{t.note}</span>
            </span>
            <svg className="gs-theme-check" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Header button that opens the theme list. Closes on Escape or a click outside. */
export default function AppearanceMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="gs-ap" ref={wrap}>
      <button
        ref={button}
        type="button"
        className={"gs-icon-btn" + (open ? " is-on" : "")}
        aria-label="Appearance"
        title="Appearance"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3.5-3.6 3.5h-2.1a1.8 1.8 0 0 0-1.3 3.1A1.5 1.5 0 0 1 12 21z" />
          <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {open && (
        <div id={panelId} className="gs-ap-panel" role="dialog" aria-label="Appearance">
          <p className="gs-ap-title">Appearance</p>
          <ThemeChoices />
          <p className="gs-ap-note">Saved on this device. Amber always means a lead needs a person.</p>
        </div>
      )}
    </div>
  );
}
