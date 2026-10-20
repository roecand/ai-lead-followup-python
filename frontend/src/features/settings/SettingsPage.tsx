import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../shared/components/AppHeader";
import { API_BASE } from "../../shared/api/client";
import { THEME_CSS } from "../../shared/lib/theme";
import { ThemeChoices } from "../../shared/components/AppearanceMenu";
import SecurityPanel from "../security/SecurityPanel";
import TeamPanel from "../team/TeamPanel";

/**
 * Settings shell. The sections are real navigation, the panels are placeholders
 * that say what will live there. Fill each panel in when its backend exists.
 *
 * Each section has its own URL, /settings/<id>, so other pages can link
 * straight to one (for example /settings/security). Plain /settings opens
 * the first section.
 */

interface Section {
  id: string;
  title: string;
  blurb: string;
  /** What this panel will hold. Delete as you build each one. */
  planned: string[];
}

const SECTIONS: Section[] = [
  {
    id: "business",
    title: "Business info",
    blurb: "The basics the assistant and your team both rely on.",
    planned: ["Business name", "Timezone", "Business hours", "Service area"],
  },
  {
    id: "knowledge",
    title: "Knowledge base",
    blurb: "What the assistant is allowed to say. Anything not covered here goes to a person.",
    planned: ["FAQs", "Policies", "Booking link"],
  },
  {
    id: "ai",
    title: "Assistant",
    blurb: "How and when the assistant replies.",
    planned: ["Pause the assistant for the whole company", "Quiet hours", "Follow-up timing"],
  },
  {
    id: "team",
    title: "Team",
    blurb: "Who can sign in and reply to leads.",
    planned: [],
  },
  {
    id: "phone",
    title: "Phone number",
    blurb: "The number your leads text.",
    planned: ["Connected number and status", "Provider connection"],
  },
  {
    id: "notifications",
    title: "Notifications",
    blurb: "How your team hears about a lead who needs a person.",
    planned: ["Email alerts", "Text alerts", "Which handoffs to alert on"],
  },
  {
    id: "security",
    title: "Security",
    blurb: "How you sign in. This only changes your own account, not the rest of your team.",
    planned: [],
  },
  {
    id: "appearance",
    title: "Appearance",
    blurb: "How the app looks on this device. Saved in this browser only.",
    planned: [],
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const {section} = useParams();
  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const activeId = active.id;
  // Replace, not push, so Back leaves Settings instead of stepping through sections.
  const setActiveId = (id: string) => navigate(`/settings/${id}`, {replace: true});

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleLogout() {
    setSigningOut(true);
    setSignOutError("");
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Logout failed");
      navigate("/", {replace: true});
    } catch {
      setSignOutError("Couldn't sign out. Try again.");
      setSigningOut(false);
    }
  }

  return (
      <div className="gs-page">
        <style>{THEME_CSS + CSS}</style>
        <AppHeader onSettings/>

        <main className="gs-main">
          <div className="gs-page-head">
            <h1 className="gs-page-title">Settings</h1>
            <p className="gs-page-sub">Options for your workspace and your own account.</p>
          </div>

          <div className="st-layout">
            <div className="st-side">
              <nav className="st-nav" aria-label="Settings sections">
                {SECTIONS.map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        className={"st-nav-item" + (s.id === activeId ? " is-on" : "")}
                        aria-current={s.id === activeId ? "true" : undefined}
                        onClick={() => setActiveId(s.id)}
                    >
                      {s.title}
                    </button>
                ))}
              </nav>

              <div className="st-signout">
                <button
                    type="button"
                    className="st-signout-btn"
                    onClick={handleLogout}
                    disabled={signingOut}
                >
                  {signingOut ? "Signing out" : "Sign out"}
                </button>
                {signOutError ? (
                    <p className="st-signout-error" role="alert">{signOutError}</p>
                ) : null}
              </div>
            </div>

            <section className="gs-card st-panel" aria-labelledby="st-panel-title">
              <h2 id="st-panel-title" className="st-panel-title">{active.title}</h2>
              <p className="st-panel-blurb">{active.blurb}</p>

              {active.id === "appearance" ? (
                  <AppearancePanel/>
              ) : active.id === "security" ? (
                  <SecurityPanel/>
              ) : active.id === "team" ? (
                  <TeamPanel/>
              ) : (
                  <div className="st-planned">
                    <p className="st-planned-label">Coming to this page</p>
                    <ul>
                      {active.planned.map((item) => (
                          <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
              )}
            </section>
          </div>
        </main>
      </div>
  );
}

/* ---------------------------------------------------------------------------
   APPEARANCE
   Same list as the header's Appearance menu, so both stay in step.
--------------------------------------------------------------------------- */

function AppearancePanel() {
  return (
    <div className="st-field">
      <p className="st-field-label">Theme</p>
      <div className="st-themes">
        <ThemeChoices />
      </div>
      <p className="st-field-note">
        Auto uses Light during the day and Original dark at night, following your
        computer or phone. The amber "needs a person" color stays the same in every
        theme so it always means one thing.
      </p>
    </div>
  );
}

const CSS = `
.st-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: start; }

.st-side { display: flex; flex-direction: column; gap: 14px; }

.st-nav { display: flex; flex-direction: column; gap: 2px; }
.st-nav-item {
  text-align: left;
  padding: 9px 12px;
  background: none; border: none; border-radius: var(--radius);
  color: var(--ink-soft);
  font-size: 14px;
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}
.st-nav-item:hover { color: var(--ink); background: var(--hover); }
.st-nav-item.is-on { color: var(--green); background: var(--green-wash); font-weight: 500; }

.st-signout { padding-top: 14px; border-top: 1px solid var(--line); }
.st-signout-btn {
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  background: none;
  border: none;
  border-radius: var(--radius);
  color: #D64545;
  font-size: 14px;
  cursor: pointer;
  transition: background 120ms ease;
}
.st-signout-btn:hover:not(:disabled) { background: rgba(214, 69, 69, 0.1); }
.st-signout-btn:disabled { opacity: 0.5; cursor: default; }
.st-signout-error { margin: 6px 12px 0; font-size: 12.5px; color: #D64545; }

.st-panel { padding: 24px; }
.st-panel-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
.st-panel-blurb { margin-top: 6px; font-size: 14px; color: var(--ink-soft); max-width: 52ch; }

.st-planned {
  margin-top: 22px; padding-top: 18px;
  border-top: 1px solid var(--line);
}
.st-planned-label { font-size: 12px; color: var(--ink-dim); }
.st-planned ul { margin: 10px 0 0; padding-left: 18px; color: var(--ink-soft); font-size: 14px; line-height: 1.8; }

.st-field { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }
.st-field-label { padding: 0; margin: 0 0 8px; font-size: 13px; font-weight: 500; color: var(--ink-soft); }
.st-field-note { margin-top: 10px; font-size: 12.5px; color: var(--ink-dim); max-width: 52ch; }

.st-themes { max-width: 340px; }

@media (max-width: 760px) {
  .st-layout { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .st-nav { flex-direction: row; overflow-x: auto; gap: 6px; padding-bottom: 2px; }
  .st-nav-item { white-space: nowrap; }
  .st-panel { padding: 18px; }
}
`;