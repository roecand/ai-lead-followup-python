import { Link } from "react-router-dom";
import type { DashboardData, DashboardSummary, HandoffItem, RecentItem, FollowUpItem } from "../lib/dashboard";
import AppHeader from "./AppHeader";
import { THEME_CSS } from "../lib/theme";
import {
  FUNNEL_STAGES,
  displayName,
  dueLabel,
  durationLabel,
  initials,
  intentLabel,
  previewOf,
  shortAgo,
  sourceLabel,
  stageLabel,
  waitingLabel,
} from "../lib/format";

interface DashboardViewProps {
  /** null while loading. */
  data: DashboardData | null;
  error?: string;
  onRetry?: () => void;
  /** Websocket state, shown in the header. */
  live?: boolean;
}

/** Where a lead's thread lives. The inbox reads ?lead= and opens that thread. */
const threadLink = (leadId: string) => `/messageboard?lead=${encodeURIComponent(leadId)}`;

export default function DashboardView({ data, error, onRetry, live }: DashboardViewProps) {
  return (
    <div className="gs-page">
      <style>{THEME_CSS + CSS}</style>
      {/* No waiting count here. The headline below already says it, louder. */}
      <AppHeader live={live} />

      <main className="gs-main">
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
            <Lede data={data} />
            <NeedsYou items={data.handoffs} />
            <Numbers s={data.summary} />

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
   LEDE
   The page answers "do I need to do anything?" before anything else.
--------------------------------------------------------------------------- */

function Lede({ data }: { data: DashboardData }) {
  const waiting = data.handoffs.length;
  const paused = data.summary.ai_paused_count;
  const handled = Math.max(0, data.summary.active_conversations - waiting - paused);

  return (
    <header className="db-lede">
      <h1 className="db-lede-title">
        {waiting > 0 ? (
          <>
            <em>{waiting}</em> {waiting === 1 ? "conversation needs" : "conversations need"} you.
          </>
        ) : (
          "Nothing needs you right now."
        )}
      </h1>
      <p className="db-lede-sub">
        The assistant is handling {handled} {waiting > 0 ? "other " : ""}active{" "}
        {handled === 1 ? "lead" : "leads"}
        {paused > 0 && <>, and you've taken over {paused}</>}.
      </p>
    </header>
  );
}

/* ---------------------------------------------------------------------------
   NEEDS YOU
--------------------------------------------------------------------------- */

function NeedsYou({ items }: { items: HandoffItem[] }) {
  // Longest wait first. The person left hanging longest is the most urgent.
  const sorted = [...items].sort(
    (a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime(),
  );

  return (
    <section className={"gs-card db-attn" + (items.length ? " is-active" : "")} aria-labelledby="db-attn-title">
      <div className="gs-card-head">
        <h2 id="db-attn-title" className="gs-card-title">Waiting on a person</h2>
        {items.length > 1 && <span className="gs-card-note">Longest wait first</span>}
      </div>

      {sorted.length === 0 ? (
        <p className="db-empty">
          When the assistant isn't sure, or a lead asks for a human, the thread shows up here first.
        </p>
      ) : (
        <ul className="db-list">
          {sorted.map((h) => (
            <li key={h.lead.id} className="db-row db-attn-row">
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
                <span className="db-row-meta">{sourceLabel(h.lead.source)}</span>
              </span>
              <span className="db-actions">
                <a className="gs-btn" href={`tel:${h.lead.phone}`}>
                  <PhoneIcon /> Call
                </a>
                <Link to={threadLink(h.lead.id)} className="gs-btn gs-btn-solid">
                  Open thread
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------------
   THE NUMBERS
   Four numbers that say whether the assistant is earning its keep.
--------------------------------------------------------------------------- */

function Numbers({ s }: { s: DashboardSummary }) {
  const delta = s.new_leads_week - s.new_leads_prev_week;
  const bookedRate = s.new_leads_week ? Math.round((s.booked_week / s.new_leads_week) * 100) : null;
  const replies = s.ai_replies_week + s.staff_replies_week;
  const aiShare = replies ? Math.round((s.ai_replies_week / replies) * 100) : null;
  const sparkMax = Math.max(1, ...s.new_leads_by_day);

  return (
    <section className="gs-card" aria-labelledby="db-num-title">
      <div className="gs-card-head">
        <h2 id="db-num-title" className="gs-card-title">How it's going</h2>
        <span className="gs-card-note">Last 7 days</span>
      </div>

      <dl className="db-kpis">
        <div className="db-kpi">
          <dt>New leads</dt>
          <dd>{s.new_leads_week}</dd>
          <p className="db-kpi-sub">
            {delta === 0 ? (
              "Same as the week before"
            ) : (
              <>
                <span className={"db-delta" + (delta > 0 ? " is-up" : "")}>
                  <ArrowIcon up={delta > 0} />
                  {Math.abs(delta)}
                </span>{" "}
                {delta > 0 ? "more" : "fewer"} than the week before
              </>
            )}
          </p>
          <div
            className="db-spark"
            role="img"
            aria-label={`New leads per day, oldest first: ${s.new_leads_by_day.join(", ")}. ${s.new_leads_today} today.`}
          >
            {s.new_leads_by_day.map((n, i) => (
              <span
                key={i}
                className={n ? "is-on" : ""}
                style={{ height: `${Math.max(n ? 14 : 6, (n / sparkMax) * 100)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="db-kpi">
          <dt>Booked</dt>
          <dd>{s.booked_week}</dd>
          <p className="db-kpi-sub">
            {bookedRate === null ? "No new leads this week" : `${bookedRate}% of this week's new leads`}
          </p>
        </div>

        <div className="db-kpi">
          <dt>Handled by the assistant</dt>
          <dd>{aiShare === null ? "n/a" : `${aiShare}%`}</dd>
          <p className="db-kpi-sub">
            {aiShare === null
              ? "No replies yet"
              : `${s.ai_replies_week} replies from the assistant, ${s.staff_replies_week} from your team`}
          </p>
        </div>

        <div className="db-kpi">
          <dt>First reply</dt>
          <dd>{s.first_reply_seconds === null ? "n/a" : durationLabel(s.first_reply_seconds)}</dd>
          <p className="db-kpi-sub">Typical wait after a lead's first text</p>
        </div>
      </dl>
    </section>
  );
}

/* ---------------------------------------------------------------------------
   FUNNEL
   Plain divs. One green, labels sit beside the bars so nothing needs a legend.
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
          {upcoming.map((f) => {
            const due = dueLabel(f.due_at);
            return (
              <li key={f.id}>
                <Link to={threadLink(f.lead_id)} className="db-row db-row-tight db-row-link">
                  <span className="db-row-body">
                    <span className="db-row-top">
                      <span className="db-row-name">{f.lead_name}</span>
                      <span className={"db-row-when" + (due === "Overdue" ? " db-alert" : "")}>{due}</span>
                    </span>
                    <span className="db-row-sub">{f.reason}</span>
                  </span>
                </Link>
              </li>
            );
          })}
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
        <p className="db-empty">No messages yet. Once a lead texts in, the conversation shows up here.</p>
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
      <div className="db-skel" style={{ height: 44, maxWidth: 460 }} />
      <div className="db-skel" style={{ height: 18, maxWidth: 340, marginBottom: 12 }} />
      <div className="gs-card db-skel" style={{ height: 150 }} />
      <div className="gs-card db-skel" style={{ height: 140 }} />
      <div className="db-two">
        <div className="gs-card db-skel" style={{ height: 260 }} />
        <div className="gs-card db-skel" style={{ height: 260 }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   ICONS
--------------------------------------------------------------------------- */

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function ArrowIcon({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         style={{ transform: up ? undefined : "rotate(180deg)" }}>
      <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
   STYLES (dashboard only. Tokens live in index.css, header in lib/theme.ts)
--------------------------------------------------------------------------- */

const CSS = `
.db-stack { display: flex; flex-direction: column; gap: 16px; }

.db-two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }

.db-empty { padding: 14px 20px 22px; color: var(--ink-dim); font-size: 14px; max-width: 60ch; }

.db-error {
  padding: 22px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  border-left: 2px solid var(--alert);
  color: var(--ink-soft); font-size: 14px;
}

/* ---------- lede ---------- */

.db-lede { padding: 8px 0 10px; }
.db-lede-title {
  margin: 0;
  font-size: clamp(30px, 4.6vw, 44px);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.03em;
  text-wrap: balance;
}
.db-lede-title em {
  font-style: normal;
  color: var(--flag);
  font-variant-numeric: tabular-nums;
}
.db-lede-sub { margin-top: 10px; font-size: 16px; color: var(--ink-soft); }

/* ---------- lists ---------- */

.db-list { list-style: none; margin: 0; padding: 8px 8px 10px; }

.db-row {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius);
}
.db-row-tight { padding-top: 9px; padding-bottom: 9px; }
.db-row-link { transition: background 110ms ease; }
.db-row-link:hover { background: var(--hover); }

.db-row-body { flex: 1; min-width: 0; display: block; }
.db-row-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.db-row-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-row-when { flex: 0 0 auto; font-size: 12px; color: var(--ink-dim); }
.db-row-sub { display: block; margin-top: 2px; font-size: 13px; color: var(--ink-soft); }
.db-row-meta { display: block; margin-top: 3px; font-size: 12px; color: var(--ink-dim); }
.db-clip { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.db-flag { color: var(--flag); font-weight: 500; }
.db-alert { color: var(--alert); font-weight: 500; }

.db-avatar {
  position: relative; flex: 0 0 auto;
  width: 34px; height: 34px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--green-wash);
  border: 1px solid var(--green-edge);
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

/* ---------- waiting on a person ---------- */

/* The one card that has a reason to be loud, and only while someone is waiting. */
.db-attn.is-active { border-left: 2px solid var(--flag); }
.db-attn-row { align-items: flex-start; padding-top: 12px; padding-bottom: 12px; }
.db-attn-row + .db-attn-row { border-top: 1px solid var(--line); border-radius: 0; }
.db-attn-row .db-avatar { margin-top: 2px; }
.db-actions { flex: 0 0 auto; display: flex; gap: 8px; align-self: center; }

/* ---------- numbers ---------- */

.db-kpis {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0; padding: 14px 0 18px;
}
.db-kpi {
  min-width: 0;
  padding: 4px 20px;
  border-left: 1px solid var(--line);
  display: flex; flex-direction: column;
}
.db-kpi:first-child { border-left: 0; }
.db-kpi dt { font-size: 13px; color: var(--ink-soft); }
.db-kpi dd {
  margin: 6px 0 0;
  font-size: 34px; font-weight: 600; letter-spacing: -0.03em; line-height: 1;
  font-variant-numeric: tabular-nums;
}
.db-kpi-sub { margin-top: 8px; font-size: 12.5px; color: var(--ink-dim); text-wrap: pretty; }

.db-delta { display: inline-flex; align-items: center; gap: 2px; font-weight: 600; color: var(--ink-soft); }
.db-delta.is-up { color: var(--green); }

.db-spark { display: flex; align-items: flex-end; gap: 3px; height: 26px; margin-top: 12px; max-width: 140px; }
.db-spark span {
  flex: 1; min-width: 3px; border-radius: 1px;
  background: var(--sink);
  transform-origin: bottom;
  animation: db-grow 400ms cubic-bezier(0.23, 1, 0.32, 1) both;
}
.db-spark span.is-on { background: var(--green-mid); }
.db-spark span:last-child.is-on { background: var(--green); }
@keyframes db-grow { from { transform: scaleY(0.2); opacity: 0; } }

/* ---------- funnel ---------- */

.db-funnel { list-style: none; margin: 0; padding: 14px 20px 20px; display: flex; flex-direction: column; gap: 10px; }
.db-funnel-row { display: grid; grid-template-columns: 84px minmax(0, 1fr) 32px; align-items: center; gap: 12px; }
.db-funnel-label { font-size: 13px; color: var(--ink-soft); }
.db-funnel-track { height: 10px; background: var(--sink); border-radius: 2px; overflow: hidden; }
.db-funnel-bar { display: block; height: 100%; min-width: 2px; background: var(--green-mid); border-radius: 2px; }
.db-funnel-bar.is-booked { background: var(--green); }
.db-funnel-n { font-size: 13px; text-align: right; font-variant-numeric: tabular-nums; }

/* ---------- loading ---------- */

.db-skel {
  border-radius: var(--radius);
  background: linear-gradient(90deg, var(--card), var(--sink), var(--card));
  background-size: 200% 100%;
  animation: db-shimmer 1.4s ease-in-out infinite;
}
@keyframes db-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ---------- responsive ---------- */

@media (max-width: 900px) {
  .db-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 20px; }
  .db-kpi:nth-child(odd) { border-left: 0; }
}
@media (max-width: 860px) {
  .db-two { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .db-attn-row { flex-wrap: wrap; }
  .db-actions { width: 100%; padding-left: 46px; }
  .db-actions .gs-btn { flex: 1; justify-content: center; padding-top: 10px; padding-bottom: 10px; }
  .db-kpi { padding: 4px 14px; }
  .db-kpi dd { font-size: 28px; }
  .db-tag-col { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .db-skel, .db-spark span { animation: none; }
}
`;
