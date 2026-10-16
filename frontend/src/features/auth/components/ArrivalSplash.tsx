import { useSyncExternalStore } from "react";
import { getPhase, subscribe, type Phase } from "../arrival";

/**
 * The hand-off from sign-up to the dashboard.
 * It sits in App.tsx above every route, so it stays on screen while the
 * sign-up scene unmounts and the dashboard mounts underneath it.
 */

export default function ArrivalSplash() {
  const current = useSyncExternalStore(subscribe, getPhase, () => "idle" as Phase);
  if (current === "idle") return null;

  return (
    <div className={"arr" + (current === "revealing" ? " is-revealing" : "")} role="status">
      <style>{CSS}</style>
      <span className="arr-sr">Opening your dashboard</span>

      <div className="arr-sun" aria-hidden="true" />
      <div className="arr-noon" aria-hidden="true" />

      <div className="arr-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="56" height="56">
          <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <path className="arr-arc" d="M5.5 16a6.5 6.5 0 0 1 13 0" pathLength={1} />
            <line className="arr-horizon" x1="2.5" y1="19.5" x2="21.5" y2="19.5" pathLength={1} />
            <line className="arr-ray arr-ray-1" x1="4.8" y1="8.3" x2="6.2" y2="9.7" />
            <line className="arr-ray arr-ray-2" x1="12" y1="4.5" x2="12" y2="6.5" />
            <line className="arr-ray arr-ray-3" x1="19.2" y1="8.3" x2="17.8" y2="9.7" />
          </g>
        </svg>
        <span className="arr-name">Meridiem</span>
      </div>
    </div>
  );
}

const CSS = `
.arr {
  position: fixed; inset: 0; z-index: 1000;
  overflow: hidden;
  font-family: var(--font);
  cursor: progress;
}
.arr-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* The sun rises from the sign-up horizon as a golden wave, and the app's own
   background (whatever theme they're on) follows right behind it. So the
   screen is never solid gold, which matters most for dark themes. */
.arr-sun,
.arr-noon {
  position: absolute; inset: 0;
  clip-path: circle(0% at 50% 112%);
  animation: arr-rise 760ms cubic-bezier(0.5, 0, 0.25, 1) forwards;
}
.arr-sun {
  background: radial-gradient(circle at 50% 112%, #F6D58C 0%, #E8B75A 45%, #D9A441 75%, #C98F33 100%);
}
.arr-noon {
  background: var(--paper);
  animation-delay: 190ms;
}
@keyframes arr-rise {
  to { clip-path: circle(150% at 50% 112%); }
}

/* The mark draws itself in the app's accent: horizon, then the sun's arc, then its rays. */
.arr-mark {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  color: var(--green);
}
/* Hidden until they start drawing. Rounded line ends would otherwise show as dots. */
.arr-arc, .arr-horizon {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
}
.arr-horizon { animation: arr-draw 380ms ease-out 700ms forwards; }
.arr-arc { animation: arr-draw 460ms ease-out 820ms forwards; }
@keyframes arr-draw {
  from { opacity: 1; stroke-dashoffset: 1; }
  to { opacity: 1; stroke-dashoffset: 0; }
}
.arr-ray {
  opacity: 0;
  transform-box: fill-box; transform-origin: center;
  animation: arr-ray 260ms ease-out forwards;
}
.arr-ray-1 { animation-delay: 1080ms; }
.arr-ray-2 { animation-delay: 1140ms; }
.arr-ray-3 { animation-delay: 1200ms; }
@keyframes arr-ray {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}
.arr-name {
  font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--ink);
  opacity: 0; transform: translateY(6px);
  animation: arr-name 420ms ease-out 980ms forwards;
}
@keyframes arr-name {
  to { opacity: 1; transform: none; }
}

/* Leaving. The mark lifts a touch and everything fades onto the dashboard. */
.arr.is-revealing { animation: arr-out 520ms ease-in-out forwards; }
.arr.is-revealing .arr-mark { transition: transform 520ms ease-in-out; transform: translateY(-10px) scale(1.04); }
@keyframes arr-out {
  to { opacity: 0; }
}
`;
