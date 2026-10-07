import { Link, NavLink } from "react-router-dom";

interface AppHeaderProps {
  /** Leads waiting on a person. Pass it to show the amber count on the right. */
  waitingCount?: number;
  /** Set to true on the settings page so the cog stays lit. */
  onSettings?: boolean;
}

/**
 * Header for the dashboard and settings pages. The inbox still draws its own,
 * so if you want one header everywhere, swap ConversationsPage's <header> for
 * this and pass waitingCount.
 * Styles live in lib/theme.ts.
 */
export default function AppHeader({ waitingCount, onSettings = false }: AppHeaderProps) {
  return (
    <header className="gs-top">
      <div className="gs-top-left">
        <span className="gs-mark">
          <svg viewBox="0 0 24 24" width="18" height="18" focusable="false" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke">
              <line x1="12" y1="2.5" x2="12" y2="21.5" />
              <line x1="3.77" y1="7.25" x2="20.23" y2="16.75" />
              <line x1="3.77" y1="16.75" x2="20.23" y2="7.25" />
            </g>
          </svg>
          <span>Green Star</span>
        </span>

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

        <Link
          to="/settings"
          className={"gs-cog" + (onSettings ? " is-on" : "")}
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