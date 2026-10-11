import { useEffect, useState } from "react";

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
