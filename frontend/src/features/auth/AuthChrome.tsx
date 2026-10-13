import { useContext, useEffect, useState } from "react";
import { SLIDE_MS, SlideDirection } from "./slide";

/**
 * The pieces the sign-in and sign-up pages share. The dusk sky behind
 * everything, and the top bar with the Meridiem mark and the Las Vegas clock.
 * Styles are in lib/authStyles.ts.
 */

export function AuthBackdrop() {
  return (
    <>
      <div className="lf-dusk" aria-hidden="true" />
      <div className="lf-stars" aria-hidden="true" />
      <div className="lf-stars-far" aria-hidden="true" />
      <div className="lf-grain" aria-hidden="true" />
    </>
  );
}

function useLasVegasTime() {
  const format = () =>
    new Date().toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
    });
  const [time, setTime] = useState(format);

  useEffect(() => {
    const id = window.setInterval(() => setTime(format()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}

export function AuthTop() {
  const clock = useLasVegasTime();

  return (
    <header className="lf-top">
      <div className="lf-brand">
        <svg className="lf-brand-mark" viewBox="0 0 24 24" width="22" height="22" focusable="false" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
            <path d="M5.5 16a6.5 6.5 0 0 1 13 0" />
            <line x1="2.5" y1="19.5" x2="21.5" y2="19.5" />
            <line x1="12" y1="4.5" x2="12" y2="6.5" />
            <line x1="4.8" y1="8.3" x2="6.2" y2="9.7" />
            <line x1="19.2" y1="8.3" x2="17.8" y2="9.7" />
          </g>
        </svg>
        <div className="lf-brand-text">
          <span className="lf-brand-name">Meridiem</span>
          <span className="lf-brand-parent">by Green Star</span>
        </div>
      </div>
      <span className="lf-locale">
        <span className="lf-locale-time">{clock}</span> in Las Vegas
      </span>
    </header>
  );
}

/** Same color as the page, shown while the refresh check runs, so there's no white flash. */
export function AuthBlank() {
  return <div style={{ minHeight: "100vh", background: "#14211A" }} />;
}

/* ---------------------------------------------------------------------------
   The "how joining works" panel on the sign-up and verify pages.
   `current` is the index of the step the person is on. Steps before it
   show a check, the current one is lit, and later ones are dimmed.
--------------------------------------------------------------------------- */

const JOIN_STEPS = [
  {
    title: "Get your invite",
    text: "It comes by email from whoever set up Meridiem for your company.",
  },
  {
    title: "Create your account",
    text: "Use the email the invite was sent to, and pick a password.",
  },
  {
    title: "Confirm your email",
    text: "We send a 6-digit code to make sure the inbox is yours.",
  },
  {
    title: "Pick up where the assistant stops",
    text: "Conversations that need a person show up in your inbox, marked in amber.",
  },
];

// Pause after the slide lands before the step completes, so the eye has
// settled on the panel when the check draws in.
const STEP_DELAY_MS = SLIDE_MS + 150;

export function JoinSteps({ current }: { current: number }) {
  const direction = useContext(SlideDirection);

  // Moving forward, the page arrives showing the previous step as current,
  // then completes it. Moving back, or with reduced motion, it just shows
  // the finished state, since un-checking a step you'd done would look wrong.
  const [animate] = useState(
    () =>
      direction > 0 &&
      current > 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [shown, setShown] = useState(animate ? current - 1 : current);

  useEffect(() => {
    if (!animate) return;
    const id = window.setTimeout(() => setShown(current), STEP_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [animate, current]);

  // Only the step that just finished draws its check, and only the step that
  // just became current gets the small pop. Steps already done stay still.
  const advanced = animate && shown === current;

  return (
    <ol className="lf-steps">
      {JOIN_STEPS.map((s, i) => {
        const state = i < shown ? "is-done" : i === shown ? "is-current" : "is-next";
        const justDone = advanced && i === current - 1;
        const justLit = advanced && i === current;
        return (
          <li
            key={s.title}
            className={"lf-step " + state + (justLit ? " is-arriving" : "")}
            aria-current={i === shown ? "step" : undefined}
          >
            <span className="lf-step-num" aria-hidden="true">
              {i < shown ? (
                <svg className={"lf-check" + (justDone ? " is-drawing" : "")} viewBox="0 0 16 16" width="12" height="12">
                  <path d="M3.5 8.5l3 3 6-7" pathLength={1} fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="lf-step-body">
              <span className="lf-step-title">
                {s.title}
                {i < shown ? <span className="lf-sr"> (done)</span> : null}
              </span>
              <span className="lf-step-text">{s.text}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}