import { useState } from "react";
import AppHeader from "../components/AppHeader";
import { THEME_CSS } from "../lib/theme";

/**
 * Settings shell. The sections are real navigation, the panels are placeholders
 * that say what will live there. Fill each panel in when its backend exists.
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
    planned: ["Members and roles", "Join code with a rotate button"],
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
];

export default function SettingsPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="gs-page">
      <style>{THEME_CSS + CSS}</style>
      <AppHeader onSettings />

      <main className="gs-main">
        <div className="gs-page-head">
          <h1 className="gs-page-title">Settings</h1>
          <p className="gs-page-sub">Company-wide options for your workspace.</p>
        </div>

        <div className="st-layout">
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

          <section className="gs-card st-panel" aria-labelledby="st-panel-title">
            <h2 id="st-panel-title" className="st-panel-title">{active.title}</h2>
            <p className="st-panel-blurb">{active.blurb}</p>

            <div className="st-planned">
              <p className="st-planned-label">Coming to this page</p>
              <ul>
                {active.planned.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const CSS = `
.st-layout { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 24px; align-items: start; }

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
.st-nav-item:hover { color: var(--ink); background: rgba(22, 36, 28, 0.045); }
.st-nav-item.is-on { color: var(--green); background: var(--green-wash); font-weight: 500; }

.st-panel { padding: 24px; }
.st-panel-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
.st-panel-blurb { margin-top: 6px; font-size: 14px; color: var(--ink-soft); max-width: 52ch; }

.st-planned {
  margin-top: 22px; padding-top: 18px;
  border-top: 1px solid var(--line);
}
.st-planned-label { font-size: 12px; color: var(--ink-dim); }
.st-planned ul { margin: 10px 0 0; padding-left: 18px; color: var(--ink-soft); font-size: 14px; line-height: 1.8; }

@media (max-width: 760px) {
  .st-layout { grid-template-columns: minmax(0, 1fr); gap: 14px; }
  .st-nav { flex-direction: row; overflow-x: auto; gap: 6px; padding-bottom: 2px; }
  .st-nav-item { white-space: nowrap; }
  .st-panel { padding: 18px; }
}
`;