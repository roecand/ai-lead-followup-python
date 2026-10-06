import { Link } from "react-router-dom";
import type { DashboardData, HandoffItem, RecentItem, FollowUpItem } from "../lib/dashboard";
import AppHeader from "./AppHeader";
import { THEME_CSS } from "../lib/theme";
import {
  FUNNEL_STAGES,
  displayName,
  dueLabel,
  initials,
  intentLabel,
  previewOf,
  shortAgo,
  stageLabel,
  waitingLabel,
} from "../lib/format";

interface DashboardViewProps {
  /** null while loading. */
  data: DashboardData | null;
  error?: string;
  onRetry?: () => void;
}

/** Where a lead's thread lives. The inbox needs to read ?lead= for this to preselect. */
const threadLink = (leadId: string) => `/messageboard?lead=${encodeURIComponent(leadId)}`;

export default function DashboardView({ data, error, onRetry }: DashboardViewProps) {
  const waiting = data?.handoffs.length;

  return (
    <div className="gs-page">
      <style>{THEME_CSS + CSS}</style>
      <AppHeader waitingCount={waiting} />

      <main className="gs-main">
        <div className="gs-page-head">
          <h1 className="gs-page-title">Dashboard</h1>
          <p className="gs-page-sub">What needs you, and how the assistant is doing.</p>
        </div>

        {error ? (
          <div className="gs-card db-error" role="alert">
            <p>{error}</p>
            {onRetry && (
              <button type="button" className="gs-btn" onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        ) : !data ? (
          <LoadingState />
        ) : (
          <div className="db-stack">
            <NeedsAttention items={data.handoffs} />

            <section className="db-tiles" aria-label="Headline numbers">
              <Tile label="New leads today" value={data.summary.new_leads_today}
                    note={data.summary.new_leads_week + " this week"} />
              <Tile label="Active conversations" value={data.summary.active_conversations}
                    note="Last 7 days" />
              <Tile label="You're handling" value={data.summary.ai_paused_count}
                    note="Assistant is silent on these" tone={data.summary.ai_paused_count > 0 ? "flag" : undefined} />
              <Tile label="Booked this week" value={data.summary.booked_this_week}
                    note="Reached the booked stage" tone="good" />
              <Tile label="Opted out" value={data.summary.opted_out_count}
                    note="Replied STOP" />
            </section>

            <div className="db-two">
              <Funnel counts={data.stage_counts} />
              <Followups items={data.followups} />
            </div>

            <Recent items={data.recent} />
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   NEEDS ATTENTION
--------------------------------------------------------------------------- */

function NeedsAttention({ items }: { items: HandoffItem[] }) {
  return (
    <section className="gs-card db-attn" aria-labelledby="db-attn-title">
      <div className="gs-card-head">
        <h2 id="db-attn-title" className="gs-card-title">Needs you</h2>
        {items.length > 0 && <span className="gs-card-note">Oldest first</span>}
      </div>

      {items.length === 0 ? (
        <p className="db-empty">Nobody is waiting on a person right now.</p>
      ) : (
        <ul className="db-list">
          {[...items]
            .sort((a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime())
            .map((h) => (
              <li key={h.lead.id} className="db-row">
                <span className="db-avatar">
                  {initials(h.lead)}
                  <span className="db-avatar-flag" />
                </span>
                <span className="db-row-body">
                  <span className="db-row-top">
                    <span className="db-row-name">{displayName(h.lead)}</span>
                    <span className="db-row-when db-flag">{waitingLabel(h.waiting_since)}</span>
                  </span>
                  <span className="db-row-sub">
                    {h.reason ??
                      (h.lead.last_intent
                        ? "Last read as " + intentLabel(h.lead.last_intent).toLowerCase()
                        : "The assistant asked for a person")}
                  </span>
                </span>
                <Link to={threadLink(h.lead.id)} className="gs-btn">Open</Link>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   HEADLINE TILES
--------------------------------------------------------------------------- */

function Tile({
  label, value, note, tone,
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "flag" | "good";
}) {
  return (
    <div className={"gs-card db-tile" + (tone ? " is-" + tone : "")}>
      <p className="db-tile-label">{label}</p>
      <p className="db-tile-value">{value}</p>
      {note && <p className="db-tile-note">{note}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   FUNNEL
   Plain divs. One green, labels sit on the bars so nothing needs a legend.
--------------------------------------------------------------------------- */

function Funnel({ counts }: { counts: DashboardData["stage_counts"] }) {
  const max = Math.max(1, ...FUNNEL_STAGES.map((s) => counts[s] ?? 0));
  const total = FUNNEL_STAGES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  return (
    <section className="gs-card" aria-labelledby="db-funnel-title">
      <div className="gs-card-head">
        <h2 id="db-funnel-title" className="gs-card-title">Lead funnel</h2>
        <span className="gs-card-note">{total} leads</span>
      </div>

      {total === 0 ? (
        <p className="db-empty">No leads yet.</p>
      ) : (
        <ul className="db-funnel">
          {FUNNEL_STAGES.map((stage) => {
            const n = counts[stage] ?? 0;
            return (
              <li key={stage} className="db-funnel-row">
                <span className="db-funnel-label">{stageLabel(stage)}</span>
                <span className="db-funnel-track">
                  <span
                    className={"db-funnel-bar" + (stage === "booked" ? " is-booked" : "")}
                    style={{ width: (n / max) * 100 + "%" }}
                  />
                </span>
                <span className="db-funnel-n">{n}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   UPCOMING FOLLOW-UPS
--------------------------------------------------------------------------- */

function Followups({ items }: { items: FollowUpItem[] }) {
  const upcoming = items
    .filter((f) => f.status === "pending")
    .sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());

  return (
    <section className="gs-card" aria-labelledby="db-fu-title">
      <div className="gs-card-head">
        <h2 id="db-fu-title" className="gs-card-title">Next follow-ups</h2>
        <span className="gs-card-note">Sent by the assistant</span>
      </div>

      {upcoming.length === 0 ? (
        <p className="db-empty">Nothing scheduled.</p>
      ) : (
        <ul className="db-list">
          {upcoming.map((f) => (
            <li key={f.id} className="db-row db-row-tight">
              <span className="db-row-body">
                <span className="db-row-top">
                  <span className="db-row-name">{f.lead_name}</span>
                  <span className={"db-row-when" + (dueLabel(f.due_at) === "Overdue" ? " db-alert" : "")}>
                    {dueLabel(f.due_at)}
                  </span>
                </span>
                <span className="db-row-sub">{f.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   RECENT CONVERSATIONS
--------------------------------------------------------------------------- */

function Recent({ items }: { items: RecentItem[] }) {
  return (
    <section className="gs-card" aria-labelledby="db-recent-title">
      <div className="gs-card-head">
        <h2 id="db-recent-title" className="gs-card-title">Recent conversations</h2>
        <Link to="/messageboard" className="gs-card-link">Open inbox</Link>
      </div>

      {items.length === 0 ? (
        <p className="db-empty">No conversations yet.</p>
      ) : (
        <ul className="db-list">
          {items.map(({ lead, last_message }) => (
            <li key={lead.id}>
              <Link to={threadLink(lead.id)} className="db-row db-row-link">
                <span className="db-avatar">
                  {initials(lead)}
                  {lead.human_required && <span className="db-avatar-flag" />}
                </span>
                <span className="db-row-body">
                  <span className="db-row-top">
                    <span className="db-row-name">{displayName(lead)}</span>
                    <span className="db-row-when">
                      {last_message ? shortAgo(last_message.created_at) : ""}
                    </span>
                  </span>
                  <span className="db-row-sub db-clip">
                    {last_message ? previewOf(last_message) : "No messages yet"}
                  </span>
                </span>
                <span className="db-tag-col">
                  {lead.opted_out ? (
                    <span className="db-tag">Opted out</span>
                  ) : lead.ai_paused ? (
                    <span className="db-tag db-flag">You're handling this</span>
                  ) : (
                    <span className="db-tag">{stageLabel(lead.stage)}</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   LOADING
--------------------------------------------------------------------------- */

function LoadingState() {
  return (
    <div className="db-stack" aria-busy="true" aria-label="Loading dashboard">
      <div className="gs-card db-skel" style={{ height: 150 }} />
      <div className="db-tiles">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="gs-card db-skel" style={{ height: 96 }} />
        ))}
      </div>
      <div className="db-two">
        <div className="gs-card db-skel" style={{ height: 260 }} />
        <div className="gs-card db-skel" style={{ height: 260 }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   STYLES (dashboard only. Palette and header live in lib/theme.ts)
--------------------------------------------------------------------------- */

const CSS = `
.db-stack { display: flex; flex-direction: column; gap: 16px; }

.db-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }

.db-empty { padding: 18px 20px 22px; color: var(--ink-dim); font-size: 14px; }

.db-error {
  padding: 22px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  border-left: 2px solid var(--alert);
  color: var(--ink-soft); font-size: 14px;
}

/* ---------- lists ---------- */

.db-list { list-style: none; margin: 0; padding: 8px 8px 10px; }

.db-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
}
.db-row-tight { padding-top: 9px; padding-bottom: 9px; }
.db-row-link { transition: background 110ms ease; }
.db-row-link:hover { background: rgba(22, 36, 28, 0.045); }

.db-row-body { flex: 1; min-width: 0; display: block; }
.db-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.db-row-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-row-when { flex: 0 0 auto; font-size: 12px; color: var(--ink-dim); }
.db-row-sub { display: block; margin-top: 2px; font-size: 13px; color: var(--ink-soft); }
.db-clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.db-flag { color: var(--flag); font-weight: 500; }
.db-alert { color: var(--alert); font-weight: 500; }

.db-avatar {
  position: relative; flex: 0 0 auto;
  width: 34px; height: 34px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--green-wash);
  border: 1px solid #D3E0D7;
  color: var(--green);
  font-size: 12px; font-weight: 600;
}
.db-avatar-flag {
  position: absolute; top: -1px; right: -1px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--flag);
  box-shadow: 0 0 0 2px var(--card);
}

.db-tag-col { flex: 0 0 auto; }
.db-tag { font-size: 12px; color: var(--ink-dim); white-space: nowrap; }

/* ---------- needs you ---------- */

/* The one card that has a reason to be loud. A thin amber edge and nothing else. */
.db-attn { border-left: 2px solid var(--flag); }

/* ---------- tiles ---------- */

.db-tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 16px; }

.db-tile { padding: 16px 18px; }
.db-tile-label { font-size: 13px; color: var(--ink-soft); }
.db-tile-value {
  margin-top: 6px;
  font-size: 32px; font-weight: 600; letter-spacing: -0.03em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.db-tile-note { margin-top: 8px; font-size: 12px; color: var(--ink-dim); }
.db-tile.is-flag .db-tile-value { color: var(--flag); }
.db-tile.is-good .db-tile-value { color: var(--green); }

/* ---------- funnel ---------- */

.db-funnel { list-style: none; margin: 0; padding: 14px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
.db-funnel-row { display: grid; grid-template-columns: 84px minmax(0, 1fr) 32px; align-items: center; gap: 12px; }
.db-funnel-label { font-size: 13px; color: var(--ink-soft); }
.db-funnel-track { height: 10px; background: var(--sink); border-radius: 2px; overflow: hidden; }
.db-funnel-bar { display: block; height: 100%; min-width: 2px; background: #6E9A82; border-radius: 2px; }
.db-funnel-bar.is-booked { background: var(--green); }
.db-funnel-n { font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }

/* ---------- loading ---------- */

.db-skel { background: linear-gradient(90deg, var(--card), var(--sink), var(--card)); background-size: 200% 100%; animation: db-shimmer 1.4s ease-in-out infinite; }
@keyframes db-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .db-skel { animation: none; } }

/* ---------- responsive ---------- */

@media (max-width: 1000px) {
  .db-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 860px) {
  .db-two { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .db-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .db-tag-col { display: none; }
}
`;