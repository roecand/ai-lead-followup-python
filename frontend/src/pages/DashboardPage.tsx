import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUp, Pause, Phone, Robot, UserCircle } from "@phosphor-icons/react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./dashboard.css";
import type { Lead, Message, Stage } from "../components/ConversationsPage";
import { apiFetch, WS_BASE } from "../api/client";
import { DEMO_COMPANY, demoLeads, demoMessages } from "./dashboardDemo";
import ThemePanel, { Segmented } from "./ThemePanel";
import { themeVars, useTheme } from "./useTheme";

const FEED_LEADS = 12; // threads preloaded for the log and message-based KPIs
const DAY = 86_400_000;
const LOG_COLLAPSED = 6;

type Range = "7" | "30" | "all";

/** GET /company/stats */
interface CompanyStats {
  range_days: number;
  new_leads: number;
  new_leads_prev: number | null;
  new_leads_by_day: number[];
  booked: number;
  ai_replies: number;
  staff_replies: number;
  first_reply_seconds: number | null;
  first_reply_samples: number;
}
const RANGE_LABEL: Record<Range, string> = { "7": "previous 7 days", "30": "previous 30 days", all: "" };

const STAGES: { key: Stage; label: string }[] = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "engaged", label: "Engaged" },
  { key: "qualified", label: "Qualified" },
  { key: "booked", label: "Booked" },
  { key: "nurture", label: "Nurture" },
];

const INTENT_LABEL: Record<string, string> = {
  emergency_service: "Emergency service",
  pricing_dispute: "Pricing question",
  financing_question: "Financing",
  quote_request: "Quote request",
  booking: "Booking",
  not_now: "Not now",
};

const intentLabel = (i: string | null) =>
  i ? INTENT_LABEL[i] ?? i.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Needs review";

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

function duration(ms: number) {
  const s = ms / 1000;
  if (s < 90) return `${Math.max(1, Math.round(s))} sec`;
  const m = s / 60;
  if (m < 90) return `${Math.round(m)} min`;
  return `${(m / 60).toFixed(1)} hr`;
}

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const displayName = (l?: Lead) => l?.first_name || l?.phone || "Unknown";
const t = (iso: string) => +new Date(iso);

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function fetchStats(days: number): Promise<CompanyStats | null> {
  try {
    const res = await apiFetch(`/company/stats?days=${days}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [params] = useSearchParams();
  // Preview data is a dev-only affordance; it must not be reachable in a production build.
  const demo = import.meta.env.DEV && params.has("demo");
  const { theme, update, reset } = useTheme();

  const [leads, setLeads] = useState<Lead[] | null>(demo ? demoLeads : null);
  const [messages, setMessages] = useState<Record<string, Message[]>>(demo ? demoMessages : {});
  const [error, setError] = useState(false);
  const [live, setLive] = useState(demo);
  const [now, setNow] = useState(() => Date.now());
  const [range, setRange] = useState<Range>("7");
  const [showAllLog, setShowAllLog] = useState(false);
  const [serverStats, setServerStats] = useState<CompanyStats | null>(null);
  const days = range === "all" ? 0 : Number(range);
  const daysRef = useRef(days);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Leads + the most recent threads (there is no company-wide activity endpoint yet)
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/company/leads");
        if (!res.ok) throw new Error();
        const all: Lead[] = await res.json();
        if (cancelled) return;
        setLeads(all);
        const recent = [...all].sort((a, b) => t(b.created_at) - t(a.created_at)).slice(0, FEED_LEADS);
        const threads = await Promise.all(
          recent.map(async (l) => {
            const r = await apiFetch(`/leads/${l.id}/messages`);
            return [l.id, r.ok ? ((await r.json()) as Message[]) : []] as const;
          }),
        );
        if (!cancelled) setMessages(Object.fromEntries(threads));
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo]);

  // Exact KPIs from the backend. If the call fails, the KPI strip falls back to computing
  // from the threads already loaded (and says it's a sample).
  useEffect(() => {
    daysRef.current = days;
    if (demo) return;
    let cancelled = false;
    fetchStats(days).then((s) => {
      if (!cancelled) setServerStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [demo, days]);

  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refreshLeads = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      const res = await apiFetch("/company/leads");
      if (res.ok) setLeads(await res.json());
      fetchStats(daysRef.current).then(setServerStats);
    }, 800);
  }, []);

  // Realtime: same /ws feed the inbox uses. Reconnects with backoff, and re-reads leads on every
  // message because the socket carries messages only, not handoff or stage changes.
  useEffect(() => {
    if (demo) return;
    let ws: WebSocket;
    let retry: ReturnType<typeof setTimeout>;
    let attempt = 0;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/ws`);
      ws.onopen = () => {
        attempt = 0;
        setLive(true);
      };
      ws.onclose = () => {
        setLive(false);
        if (closed) return;
        retry = setTimeout(connect, Math.min(15_000, 1000 * 2 ** attempt++));
      };
      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type !== "new_message") return;
        setMessages((prev) => ({
          ...prev,
          [data.lead_id]: [...(prev[data.lead_id] ?? []), data.message],
        }));
        refreshLeads();
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      clearTimeout(refreshTimer.current);
      ws.close();
    };
  }, [demo, refreshLeads]);

  const stats = useMemo(() => {
    const L = leads ?? [];
    const waitingSince = (l: Lead) => {
      const th = messages[l.id];
      return t(th?.length ? th[th.length - 1].created_at : l.created_at);
    };
    // Longest-waiting first: the customer who has been left hanging the longest is the most urgent.
    const needsYou = L.filter((l) => l.human_required && !l.opted_out).sort(
      (a, b) => waitingSince(a) - waitingSince(b),
    );
    const paused = L.filter((l) => l.ai_paused);
    const active = L.filter((l) => !["closed", "do_not_contact"].includes(l.stage));
    const byStage = Object.fromEntries(
      STAGES.map((s) => [s.key, L.filter((l) => l.stage === s.key).length]),
    ) as Record<Stage, number>;

    // KPIs for the selected range
    const days = range === "all" ? 0 : Number(range);
    const from = days ? now - days * DAY : 0;
    const prevFrom = days ? now - 2 * DAY * days : 0;
    const curLeads = L.filter((l) => t(l.created_at) >= from);
    const prevLeads = days ? L.filter((l) => t(l.created_at) >= prevFrom && t(l.created_at) < from) : [];

    const buckets = days || 30;
    const spark = Array.from({ length: buckets }, () => 0);
    for (const l of L) {
      const age = Math.floor((now - t(l.created_at)) / DAY);
      if (age >= 0 && age < buckets) spark[buckets - 1 - age]++;
    }

    const booked = curLeads.filter((l) => l.stage === "booked").length;

    const inWindow = Object.values(messages)
      .flat()
      .filter((m) => t(m.created_at) >= from);
    const ai = inWindow.filter((m) => m.author === "assistant").length;
    const staff = inWindow.filter((m) => m.author === "staff").length;

    // First response: customer's first inbound text in the window -> the next outbound message
    const waits: number[] = [];
    for (const th of Object.values(messages)) {
      const sorted = [...th].sort((a, b) => t(a.created_at) - t(b.created_at));
      const i = sorted.findIndex((m) => m.author === "customer" && t(m.created_at) >= from);
      if (i < 0) continue;
      const reply = sorted.slice(i + 1).find((m) => m.direction === "outbound");
      if (reply) waits.push(t(reply.created_at) - t(sorted[i].created_at));
    }

    return {
      needsYou,
      paused,
      active,
      byStage,
      newLeads: curLeads.length,
      newLeadsDelta: days ? curLeads.length - prevLeads.length : null,
      spark,
      booked,
      bookedRate: curLeads.length ? Math.round((booked / curLeads.length) * 100) : null,
      ai,
      staff,
      aiShare: ai + staff ? Math.round((ai / (ai + staff)) * 100) : null,
      firstResponse: median(waits),
    };
  }, [leads, messages, now, range]);

  const sampled = !demo && (leads?.length ?? 0) > Object.keys(messages).length;
  const kpi = useMemo(() => {
    const s = serverStats;
    if (s && s.range_days === days) {
      return {
        newLeads: s.new_leads,
        newLeadsDelta: s.new_leads_prev === null ? null : s.new_leads - s.new_leads_prev,
        spark: s.new_leads_by_day,
        booked: s.booked,
        bookedRate: s.new_leads ? Math.round((s.booked / s.new_leads) * 100) : null,
        ai: s.ai_replies,
        staff: s.staff_replies,
        aiShare:
          s.ai_replies + s.staff_replies
            ? Math.round((s.ai_replies / (s.ai_replies + s.staff_replies)) * 100)
            : null,
        firstResponse: s.first_reply_seconds === null ? null : s.first_reply_seconds * 1000,
        sampled: false,
      };
    }
    return {
      newLeads: stats.newLeads,
      newLeadsDelta: stats.newLeadsDelta,
      spark: stats.spark,
      booked: stats.booked,
      bookedRate: stats.bookedRate,
      ai: stats.ai,
      staff: stats.staff,
      aiShare: stats.aiShare,
      firstResponse: stats.firstResponse,
      sampled,
    };
  }, [serverStats, days, stats, sampled]);

  const leadById = useMemo(() => new Map((leads ?? []).map((l) => [l.id, l])), [leads]);

  const feed = useMemo(
    () =>
      Object.values(messages)
        .flat()
        .sort((a, b) => t(b.created_at) - t(a.created_at))
        .slice(0, 30),
    [messages],
  );

  const lastBy = (id: string) => {
    const th = messages[id];
    return th?.length ? th[th.length - 1] : undefined;
  };

  const loading = leads === null && !error;
  const pipelineTotal = Math.max(1, STAGES.reduce((n, s) => n + stats.byStage[s.key], 0));
  const handledByAi = Math.max(0, stats.active.length - stats.needsYou.length - stats.paused.length);
  const sparkMax = Math.max(1, ...kpi.spark);
  const visibleFeed = showAllLog ? feed : feed.slice(0, LOG_COLLAPSED);

  return (
    <div
      className="dash"
      data-mode={theme.mode}
      data-radius={theme.radius}
      data-density={theme.density}
      style={themeVars(theme)}
    >
      <header className="dash-bar">
        <div className="dash-bar-inner">
          <span className="dash-brand">{demo ? DEMO_COMPANY : "Lead desk"}</span>
          <nav className="dash-nav" aria-label="Primary">
            <Link to="/dashboard" aria-current="page">Overview</Link>
            <Link to="/messageboard">Inbox</Link>
          </nav>
          <span className={`dash-live ${live ? "is-live" : ""}`} role="status">
            <span className="dash-live-dot" aria-hidden="true" />
            {live ? "Live" : "Offline"}
          </span>
          <ThemePanel theme={theme} onChange={update} onReset={reset} />
        </div>
      </header>

      <main className="dash-main">
        {error ? (
          <section className="dash-state">
            <h1>Can't reach the server</h1>
            <p>Your leads didn't load. Check your connection and refresh. Nothing has been lost.</p>
          </section>
        ) : loading ? (
          <div className="dash-skel" aria-busy="true" aria-label="Loading">
            <div className="sk sk-h" />
            <div className="sk sk-p" />
            <div className="sk sk-kpis" />
            <div className="sk sk-row" />
            <div className="sk sk-row" />
          </div>
        ) : (
          <div className="dash-flow">
            <section className="dash-lede">
              <h1>
                {stats.needsYou.length > 0 ? (
                  <>
                    <em>{stats.needsYou.length}</em>{" "}
                    {stats.needsYou.length === 1 ? "conversation needs" : "conversations need"} you.
                  </>
                ) : (
                  <>Nothing needs you right now.</>
                )}
              </h1>
              <p>
                The assistant is handling {handledByAi} other active {handledByAi === 1 ? "lead" : "leads"}
                {stats.paused.length > 0 && `, and is paused on ${stats.paused.length}`}.
              </p>
            </section>

            <section className="dash-kpis" aria-labelledby="kpi-h">
              <div className="kpis-head">
                <h2 id="kpi-h">How it's going</h2>
                <Segmented<Range>
                  label="Time range"
                  hideLabel
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                    { value: "all", label: "All time" },
                  ]}
                />
              </div>

              <dl className="kpis">
                <div className="kpi">
                  <dt>New leads</dt>
                  <dd>{kpi.newLeads}</dd>
                  <p className="kpi-sub">
                    {kpi.newLeadsDelta === null ? (
                      "Since you started"
                    ) : kpi.newLeadsDelta === 0 ? (
                      `Same as the ${RANGE_LABEL[range]}`
                    ) : (
                      <>
                        <span className={`delta ${kpi.newLeadsDelta > 0 ? "up" : "down"}`}>
                          {kpi.newLeadsDelta > 0 ? <ArrowUp size={12} weight="bold" aria-hidden="true" /> : <ArrowDown size={12} weight="bold" aria-hidden="true" />}
                          {Math.abs(kpi.newLeadsDelta)}
                        </span>{" "}
                        {kpi.newLeadsDelta > 0 ? "more" : "fewer"} than the {RANGE_LABEL[range]}
                      </>
                    )}
                  </p>
                  <div className="spark" role="img" aria-label={`New leads per day: ${kpi.spark.join(", ")}`}>
                    {kpi.spark.map((n, i) => (
                      <span key={i} style={{ height: `${Math.max(n ? 12 : 4, (n / sparkMax) * 100)}%` }} className={n ? "on" : ""} />
                    ))}
                  </div>
                </div>

                <div className="kpi">
                  <dt>Booked</dt>
                  <dd>{kpi.booked}</dd>
                  <p className="kpi-sub">
                    {kpi.bookedRate === null ? "No new leads in this range" : `${kpi.bookedRate}% of new leads`}
                  </p>
                </div>

                <div className="kpi">
                  <dt>Handled by AI</dt>
                  <dd>{kpi.aiShare === null ? "n/a" : `${kpi.aiShare}%`}</dd>
                  <p className="kpi-sub">
                    {kpi.aiShare === null ? "No replies yet" : `${kpi.ai} AI replies, ${kpi.staff} from you`}
                  </p>
                  {kpi.sampled && <p className="kpi-note">From your latest {FEED_LEADS} conversations</p>}
                </div>

                <div className="kpi">
                  <dt>First reply</dt>
                  <dd>{kpi.firstResponse === null ? "n/a" : duration(kpi.firstResponse)}</dd>
                  <p className="kpi-sub">Typical wait after a customer's first text</p>
                  {kpi.sampled && <p className="kpi-note">From your latest {FEED_LEADS} conversations</p>}
                </div>
              </dl>
            </section>

            <div className="dash-grid">
              <section className="dash-queue" aria-labelledby="q-h">
                <h2 id="q-h">Waiting on a person</h2>
                {stats.needsYou.length === 0 ? (
                  <p className="dash-empty">
                    When the assistant isn't sure, or a customer asks for a human, the thread shows up here first.
                  </p>
                ) : (
                  <ul className="queue">
                    {stats.needsYou.map((l, i) => {
                      const last = lastBy(l.id);
                      return (
                        <li key={l.id} style={{ ["--i" as string]: i }}>
                          <div className="q-head">
                            <span className="q-name">{displayName(l)}</span>
                            <span className="q-why">{intentLabel(l.last_intent)}</span>
                            <span className="q-time">{ago(last?.created_at ?? l.created_at, now)}</span>
                          </div>
                          {last && <p className="q-snip">{last.body}</p>}
                          <div className="q-foot">
                            <span className="q-meta">{l.source}</span>
                            <a className="q-call" href={`tel:${l.phone}`}>
                              <Phone size={15} weight="bold" aria-hidden="true" /> Call
                            </a>
                            <Link className="q-open" to="/messageboard">
                              Open thread <ArrowRight size={15} weight="bold" aria-hidden="true" />
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <aside className="dash-side">
                <div className="pipe">
                  <h2>Pipeline</h2>
                  <div
                    className="pipe-bar"
                    role="img"
                    aria-label={STAGES.map((s) => `${s.label} ${stats.byStage[s.key]}`).join(", ")}
                  >
                    {STAGES.map((s, i) => (
                      <span
                        key={s.key}
                        className={`seg seg-${s.key}`}
                        style={{ flexGrow: stats.byStage[s.key], ["--i" as string]: i }}
                        hidden={stats.byStage[s.key] === 0}
                      />
                    ))}
                  </div>
                  <ul className="pipe-key">
                    {STAGES.map((s) => (
                      <li key={s.key}>
                        <span className={`sw sw-${s.key}`} aria-hidden="true" />
                        <span>{s.label}</span>
                        <b>{stats.byStage[s.key]}</b>
                      </li>
                    ))}
                  </ul>
                  <p className="pipe-note">
                    {stats.active.length} active leads, {Math.round((stats.byStage.booked / pipelineTotal) * 100)}% booked.
                  </p>
                </div>
              </aside>
            </div>

            <section className="dash-log" aria-labelledby="log-h">
              <div className="log-head">
                <h2 id="log-h">Shift log</h2>
                <p>Recent messages, newest first. New ones appear as they arrive.</p>
              </div>
              {feed.length === 0 ? (
                <p className="dash-empty">No messages yet. Once a lead texts in, you'll see the conversation here.</p>
              ) : (
                <>
                  <ol className="log">
                    {visibleFeed.map((msg) => {
                      const who = leadById.get(msg.lead_id);
                      const Icon = msg.author === "assistant" ? Robot : msg.author === "staff" ? UserCircle : null;
                      const prefix = msg.author === "assistant" ? "Assistant to " : msg.author === "staff" ? "You to " : "";
                      return (
                        <li key={msg.id} className={`log-row by-${msg.author}`}>
                          <time dateTime={msg.created_at}>{clock(msg.created_at)}</time>
                          <span className="log-who">
                            {Icon ? <Icon size={16} aria-hidden="true" /> : <span className="log-ico-gap" />}
                            <span>
                              {prefix}
                              {displayName(who)}
                            </span>
                            {who?.ai_paused && <Pause size={12} weight="fill" aria-label="AI paused" />}
                          </span>
                          <span className="log-body">{msg.body}</span>
                        </li>
                      );
                    })}
                  </ol>
                  {feed.length > LOG_COLLAPSED && (
                    <button type="button" className="log-more" onClick={() => setShowAllLog((v) => !v)}>
                      {showAllLog ? "Show fewer" : `Show all ${feed.length}`}
                    </button>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
