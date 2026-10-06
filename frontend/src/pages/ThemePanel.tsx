import { useEffect, useRef, useState } from "react";
import { ArrowCounterClockwise, SlidersHorizontal } from "@phosphor-icons/react";
import { ACCENTS, DEFAULT_THEME, type Density, type Mode, type Radius, type Theme } from "./useTheme";

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="segset">
      <legend className={hideLabel ? "sr" : undefined}>{label}</legend>
      <div className="segrow">
        {options.map((o) => (
          <label key={o.value}>
            <input type="radio" name={label} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ThemePanel({
  theme,
  onChange,
  onReset,
}: {
  theme: Theme;
  onChange: (patch: Partial<Theme>) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
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

  const isPreset = ACCENTS.some((a) => a.value === theme.accent);
  const isDefault = JSON.stringify(theme) === JSON.stringify(DEFAULT_THEME);

  return (
    <div className="tp" ref={wrap}>
      <button
        type="button"
        className="tp-btn"
        aria-expanded={open}
        aria-controls="tp-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Appearance</span>
      </button>

      {open && (
        <div id="tp-panel" className="tp-panel" role="dialog" aria-label="Appearance settings">
          <Segmented<Mode>
            label="Theme"
            value={theme.mode}
            onChange={(mode) => onChange({ mode })}
            options={[
              { value: "system", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />

          <fieldset className="segset">
            <legend>Accent color</legend>
            <div className="swatches">
              {ACCENTS.map((a) => (
                <label key={a.name} title={a.name}>
                  <input
                    type="radio"
                    name="Accent color"
                    checked={theme.accent === a.value}
                    onChange={() => onChange({ accent: a.value })}
                  />
                  <span className="sw-dot" style={{ background: a.swatch }} />
                  <span className="sr">{a.name}</span>
                </label>
              ))}
              <label title="Custom color" className="sw-custom">
                <input
                  ref={customRef}
                  type="color"
                  value={theme.accent ?? "#17613f"}
                  onChange={(e) => onChange({ accent: e.target.value })}
                  aria-label="Custom accent color"
                />
                <span className={`sw-dot sw-rainbow ${!isPreset ? "is-on" : ""}`} />
              </label>
            </div>
          </fieldset>

          <Segmented<Radius>
            label="Corners"
            value={theme.radius}
            onChange={(radius) => onChange({ radius })}
            options={[
              { value: "sharp", label: "Sharp" },
              { value: "soft", label: "Soft" },
              { value: "round", label: "Round" },
            ]}
          />
          <Segmented<Density>
            label="Spacing"
            value={theme.density}
            onChange={(density) => onChange({ density })}
            options={[
              { value: "comfortable", label: "Roomy" },
              { value: "compact", label: "Compact" },
            ]}
          />

          <button type="button" className="tp-reset" onClick={onReset} disabled={isDefault}>
            <ArrowCounterClockwise size={14} aria-hidden="true" /> Reset to default
          </button>
          <p className="tp-note">Saved on this device. The amber "needs a person" color stays fixed so it always means the same thing.</p>
        </div>
      )}
    </div>
  );
}
