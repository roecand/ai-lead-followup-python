/**
 * Runs the sign-up to dashboard hand-off. ArrivalSplash.tsx draws it.
 *
 * Call playArrival() from the last sign-up step. `onCovered` runs once the
 * screen is fully covered (that's where you navigate), and `ready` holds the
 * reveal until the dashboard's data is in, up to a limit so a slow server
 * can't trap anyone behind it.
 */

export type Phase = "idle" | "covering" | "holding" | "revealing";

const COVER_MS = 960; // sun rises and the background fills in behind it
const MIN_TOTAL_MS = 1650; // long enough for the mark to finish drawing
const MAX_WAIT_MS = 2500; // extra time allowed for slow data
const REVEAL_MS = 520; // fade to the dashboard

let phase: Phase = "idle";
const listeners = new Set<() => void>();

function setPhase(next: Phase) {
  phase = next;
  listeners.forEach((l) => l());
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export async function playArrival({
  onCovered,
  ready,
}: {
  onCovered: () => void;
  ready?: Promise<unknown>;
}): Promise<void> {
  if (phase !== "idle") return;

  // People who asked for less motion just go straight there.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onCovered();
    return;
  }

  const started = performance.now();
  setPhase("covering");
  await sleep(COVER_MS);

  onCovered();
  setPhase("holding");

  await Promise.race([ready?.catch(() => undefined), sleep(MAX_WAIT_MS)]);
  await sleep(Math.max(0, MIN_TOTAL_MS - (performance.now() - started)));
  await nextPaint(); // let the dashboard paint with its data before showing it

  setPhase("revealing");
  await sleep(REVEAL_MS);
  setPhase("idle");
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPhase(): Phase {
  return phase;
}
