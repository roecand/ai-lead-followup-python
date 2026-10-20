import { Link, NavLink } from "react-router-dom";
import AppearanceMenu from "./AppearanceMenu";

interface AppHeaderProps {
  waitingCount?: number;
  live?: boolean;
  onSettings?: boolean;
}

// Header for every signed-in page. Styles live in shared/lib/theme.ts.
export default function AppHeader({ waitingCount, live, onSettings = false }: AppHeaderProps) {
  return (
    <header className="gs-top">
      <div className="gs-top-left">
        <Link to="/dashboard" className="gs-mark" aria-label="Meridiem home">
          <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
              <path d="M5.5 16a6.5 6.5 0 0 1 13 0" />
              <line x1="2.5" y1="19.5" x2="21.5" y2="19.5" />
              <line x1="12" y1="4.5" x2="12" y2="6.5" />
              <line x1="4.8" y1="8.3" x2="6.2" y2="9.7" />
              <line x1="19.2" y1="8.3" x2="17.8" y2="9.7" />
            </g>
          </svg>
          <span className="gs-mark-text">
            <span className="gs-mark-name">Meridiem</span>
            <span className="gs-mark-parent">by Green Star</span>
          </span>
        </Link>

        <nav className="gs-nav" aria-label="Main">
          <NavLink to="/dashboard" className={({ isActive }) => "gs-nav-link" + (isActive ? " is-on" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/messageboard" className={({ isActive }) => "gs-nav-link" + (isActive ? " is-on" : "")}>
            Inbox
          </NavLink>
        </nav>
      </div>

      <div className="gs-top-right">
        {waitingCount !== undefined &&
          (waitingCount > 0 ? (
            <span className="gs-waiting">
              <span className="gs-dot-sun" />
              {waitingCount} waiting on you
            </span>
          ) : (
            <span className="gs-waiting gs-waiting-clear">Nothing waiting on you</span>
          ))}

        {live !== undefined && (
          <span className={"gs-live" + (live ? " is-live" : "")} role="status" title={live ? "Updates arrive as they happen" : "Not connected. Refresh to see new messages."}>
            <span className="gs-live-dot" aria-hidden="true" />
            <span className="gs-live-label">{live ? "Live" : "Offline"}</span>
          </span>
        )}

        <AppearanceMenu />

        <Link
          to="/settings"
          className={"gs-icon-btn" + (onSettings ? " is-on" : "")}
          aria-label="Settings"
          title="Settings"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}