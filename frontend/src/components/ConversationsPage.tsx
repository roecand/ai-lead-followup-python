import { useEffect, useMemo, useRef, useState } from "react";

// TYPES

export type Stage =
  | "new" | "contacted" | "engaged" | "qualified"
  | "booked" | "nurture" | "closed" | "do_not_contact";

export type Direction = "inbound" | "outbound" | "internal";

export type Author = "customer" | "assistant" | "staff" | "system";

export interface Message {
  id: string;
  lead_id: string;
  direction: Direction;
  author: Author;
  body: string;
  intent?: string | null;
  confidence?: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  first_name: string | null;
  phone: string;
  source: string;
  stage: Stage;
  consent_to_sms: boolean;
  opted_out: boolean;
  human_required: boolean;
  last_intent: string | null;
  created_at: string;
  ai_paused?: boolean;
}

interface ConversationsPageProps {
  leads?: Lead[];
  messagesByLead?: Record<number, Message[]>;
  onSelectLead?: (leadId: string) => void | Promise<void>;
  onSendMessage?: (args: { leadId: string; body: string }) => void | Promise<void>;
  onToggleAi?: (args: { leadId: string; paused: boolean }) => void | Promise<void>;
  onResolveLead?: (leadId: string) => void | Promise<void>;
  /** Shown on staff-authored messages. Swap for the signed-in user's name. */
  staffName?: string;
  pendingAiToggles?: Set<string>;
}

// LAYOUT CONSTANTS
const RAIL_DEFAULT = 320;
const RAIL_MIN = 240;
const RAIL_MAX = 520;
const RAIL_COMPACT = 68;
const SNAP_BELOW = 190;

/** One SMS segment. Past this a message splits into multiple sends and costs
 *  more, which is why the counter turns amber rather than just counting up. */
const SEGMENT = 160;

export default function ConversationsPage({
  leads: leadsProp,
  messagesByLead: messagesProp,
  onSelectLead,
  onSendMessage,
  onToggleAi,
  onResolveLead,
  staffName = "You",
  pendingAiToggles,
}: ConversationsPageProps) {
  /* --- data -----------------------------------------------------------------
     Local state below is used only for OPTIMISTIC UI, e.g. showing a message
     the instant you hit send, before your backend has confirmed it. If you'd
     rather always wait on the server response, you can drop the local
     appendLocal() calls and rely entirely on messagesProp updating.

     Hook 1
*/
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);
  const [localMessages, setLocalMessages] = useState<Record<string, Message[]>>({});

  const leads = leadsProp ?? localLeads;
  const messagesByLead = messagesProp ?? localMessages;

  /* --- selection and filtering -------------------------------------------- */
  // The user's explicit pick, if they've made one. Starts unset.
  const [selectedIdOverride, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needs_you" | "paused">("all");
  const [query, setQuery] = useState("");

  /* --- rail sizing --------------------------------------------------------- */
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const compact = railWidth <= RAIL_COMPACT;

  /* --- composer ------------------------------------------------------------ */
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [resolving, setResolving] = useState(false);

  /* --- detail panel -------------------------------------------------------- */
  const [showDetail, setShowDetail] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* If nothing's been explicitly picked yet, fall back to the first lead. */
  const selectedId =
    selectedIdOverride != null && leads.some((l) => l.id === selectedIdOverride)
      ? selectedIdOverride
      : leads[0]?.id ?? null;

  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const thread = selectedId != null ? messagesByLead[selectedId] ?? [] : [];
  const needsYouCount = leads.filter((l) => l.human_required).length;
  const pausedCount = leads.filter((l) => l.ai_paused).length;

  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads
      .filter((l) =>
        filter === "needs_you" ? l.human_required : filter === "paused" ? l.ai_paused : true
      )
      .filter((l) =>
        !q
          ? true
          : (l.first_name ?? "").toLowerCase().includes(q) || l.phone.includes(q)
      )
      .sort((a, b) => {
        // Anyone waiting on a person floats up. Everything else newest first.
        if (a.human_required !== b.human_required) return a.human_required ? -1 : 1;
        return lastActivity(messagesByLead[b.id]) - lastActivity(messagesByLead[a.id]);
      });
  }, [leads, messagesByLead, filter, query]);

  const aiTogglePending = pendingAiToggles?.has(selected?.id ?? "") ?? false;
  /* Stick to the bottom of the thread on open and on every new message. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedId, thread.length]);

  // Drag-to-resize. Pointer events cover mouse, trackpad, and touch in one go.
  useEffect(() => {
    if (!dragging) return;

    function onMove(e: PointerEvent) {
      const x = e.clientX;
      setRailWidth(
        x < SNAP_BELOW ? RAIL_COMPACT : Math.min(RAIL_MAX, Math.max(RAIL_MIN, x))
      );
    }
    function onUp() {
      setDragging(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Stops the browser selecting text across the page mid-drag.
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging]);

  async function pickLead(id: string) {
    setSelectedId(id);
    setDraft("");
    setError("");
    // BACKEND HOOK 2 of 5
    if (onSelectLead) await onSelectLead(id);
  }

  async function setAiPaused(paused: boolean) {
    if (!selected) return;
    /* ======================= BACKEND HOOK 3 of 5 =========================
       Pause or resume the assistant on this thread.
       Suggested route:  POST /leads/{id}/ai  body { paused: boolean }
       Nothing like this exists yet. `service.receive` would read the flag
       and return early instead of calling the LLM when it's true.
       ===================================================================== */
    if (onToggleAi) {
      await onToggleAi({ leadId: selected.id, paused });
      return;
    }
    // No onToggleAi passed in: update local state only, so the UI still reacts.
    setLocalLeads((prev) =>
      prev.map((l) => (l.id === selected.id ? { ...l, ai_paused: paused } : l))
    );
    appendLocal(selected.id, {
      direction: "internal",
      author: "system",
      body: paused
        ? "You took over. The assistant won't reply here until you hand it back."
        : "Handed back to the assistant.",
    });
  }

  async function resolveHandoff() {
    if (!selected) return;
    /* BACKEND HOOK 5 of 5 */
    if (onResolveLead) {
      setResolving(true);
      try {
        await onResolveLead(selected.id);
      } finally {
        setResolving(false);
      }
      return;
    }
    // No onResolveLead passed in: clear the flag locally only.
    setLocalLeads((prev) =>
      prev.map((l) => (l.id === selected.id ? { ...l, human_required: false } : l))
    );
  }

  async function send() {
    const body = draft.trim();
    if (!body || !selected || sending) return;

    if (selected.opted_out) {
      setError("This lead replied STOP. Messaging them is blocked.");
      return;
    }

    setSending(true);
    setError("");
    try {
      /* BACKEND HOOK 4 of 5 */
      if (onSendMessage) {
        await onSendMessage({ leadId: selected.id, body });
      } else {
        // No onSendMessage passed in: reflect the send locally only
        appendLocal(selected.id, { direction: "outbound", author: "staff", body });
        /* Sending while the assistant is live pauses it automatically. prevent race conditions */
        if (!selected.ai_paused) {
          setLocalLeads((prev) =>
            prev.map((l) =>
              l.id === selected.id ? { ...l, ai_paused: true, human_required: false } : l
            )
          );
          appendLocal(selected.id, {
            direction: "internal",
            author: "system",
            body: "You took over. The assistant won't reply here until you hand it back.",
          });
        }
      }
      setDraft("");
    } catch {
      setError("Message failed to send. Check connection and try again");
    } finally {
      setSending(false);
    }
  }

  // Only touches local fallback state.
  function appendLocal(leadId: string, partial: Omit<Message, "id" | "lead_id" | "created_at">) {
    setLocalMessages((prev) => {
      const list = prev[leadId] ?? [];
      return {
        ...prev,
        [leadId]: [
          ...list,
          {
            id: String(Date.now() + Math.random()),
            lead_id: leadId,
            created_at: new Date().toISOString(),
            ...partial,
          },
        ],
      };
    });
  }

  function onComposerKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const overLimit = draft.length > SEGMENT;
  const blocked = selected?.opted_out ?? false;

  return (
    <div className="gs-root">
      <style>{CSS}</style>

      <div className="gs-grain" aria-hidden="true" />

      {/* -----------------------------------------------------------------
          HEADER. If already have app chrome, delete this later
          and the .gs-body top padding goes with it.
      ------------------------------------------------------------------ */}
      <header className="gs-top">
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
        <span className="gs-top-right">
          {needsYouCount > 0 ? (
            <span className="gs-waiting">
              <span className="gs-dot-sun" />
              {needsYouCount} waiting on you
            </span>
          ) : (
            <span className="gs-waiting gs-waiting-clear">Nothing waiting on you</span>
          )}
        </span>
      </header>

      <div className="gs-body">
        {/* LEFT RAIL. */}
        <aside
          className={"gs-rail" + (compact ? " is-compact" : "")}
          style={{ width: railWidth }}
        >
          {!compact && (
            <div className="gs-rail-head">
              <input
                className="gs-search"
                type="search"
                placeholder="Search name or number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="gs-filters" role="tablist" aria-label="Filter conversations">
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "all"}
                  className={"gs-filter" + (filter === "all" ? " is-on" : "")}
                  onClick={() => setFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "needs_you"}
                  className={"gs-filter" + (filter === "needs_you" ? " is-on" : "")}
                  onClick={() => setFilter("needs_you")}
                >
                  Needs you
                  {needsYouCount > 0 && <span className="gs-count">{needsYouCount}</span>}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "paused"}
                  className={"gs-filter" + (filter === "paused" ? " is-on" : "")}
                  onClick={() => setFilter("paused")}
                >
                  Paused
                  {pausedCount > 0 && <span className="gs-count">{pausedCount}</span>}
                </button>
              </div>
            </div>
          )}

          <div className="gs-list">
            {visibleLeads.length === 0 ? (
              <p className="gs-empty-rail">
                {filter === "needs_you"
                  ? "No one is waiting on a person right now."
                  : filter === "paused"
                  ? "No conversations are paused right now."
                  : leads.length === 0
                  ? "No conversations loaded yet."
                  : "No conversations match that search."}
              </p>
            ) : (
              visibleLeads.map((lead) => {
                const list = messagesByLead[lead.id] ?? [];
                const last = list[list.length - 1];
                const on = lead.id === selectedId;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    className={"gs-row" + (on ? " is-on" : "")}
                    onClick={() => pickLead(lead.id)}
                    aria-current={on ? "true" : undefined}
                    title={compact ? displayName(lead) : undefined}
                  >
                    <span className="gs-avatar">
                      {initials(lead)}
                      {lead.human_required && <span className="gs-avatar-flag" />}
                    </span>

                    {!compact && (
                      <span className="gs-row-body">
                        <span className="gs-row-top">
                          <span className="gs-row-name">{displayName(lead)}</span>
                          <span className="gs-row-time">
                            {last ? shortAgo(last.created_at) : ""}
                          </span>
                        </span>
                        <span className="gs-row-preview">
                          {last ? previewOf(last) : "No messages yet"}
                        </span>
                        <span className="gs-row-meta">
                          {lead.opted_out ? (
                            <span className="gs-tag gs-tag-off">Opted out</span>
                          ) : lead.ai_paused ? (
                            <span className="gs-tag gs-tag-sun">You're handling this</span>
                          ) : (
                            <span className="gs-tag">{stageLabel(lead.stage)}</span>
                          )}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* DRAG HANDLE. */}
        <div
          className={"gs-handle" + (dragging ? " is-dragging" : "")}
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => setRailWidth(RAIL_DEFAULT)}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize conversation list"
          tabIndex={0}
          onKeyDown={(e) => {
            // Keyboard resize
            if (e.key === "ArrowLeft")
              setRailWidth((w) => (w <= RAIL_MIN ? RAIL_COMPACT : Math.max(RAIL_MIN, w - 24)));
            if (e.key === "ArrowRight")
              setRailWidth((w) => (w <= RAIL_COMPACT ? RAIL_MIN : Math.min(RAIL_MAX, w + 24)));
          }}
        >
          <span className="gs-handle-grip" aria-hidden="true" />
        </div>

        {/* CENTER. Thread and composer. */}
        <main className="gs-thread">
          {!selected ? (
            <div className="gs-empty">
              <p className="gs-empty-line">
                {leads.length === 0
                  ? "No conversations yet."
                  : "Pick a conversation to read it."}
              </p>
            </div>
          ) : (
            <>
              <div className="gs-thread-head">
                <div className="gs-who">
                  <h1 className="gs-who-name">{displayName(selected)}</h1>
                  <p className="gs-who-sub">
                    {selected.phone} &middot; {stageLabel(selected.stage)}
                  </p>
                </div>

                <div className="gs-controls">
                  {/* The one control that matters on this page, so it gets
                      the accent and everything else stays quiet. */}
                  <span className={"gs-ai" + (selected.ai_paused ? " is-paused" : "")}>
                    <span className="gs-ai-dot" />
                    {selected.ai_paused ? "You're handling this" : "Assistant is replying"}
                  </span>
                  <button
                    type="button"
                    className="gs-takeover"
                    onClick={() => setAiPaused(!selected.ai_paused)}
                    disabled={ aiTogglePending }
                  >
                    {selected.ai_paused ? "Give back to assistant" : "Take over"}
                  </button>
                  <button
                    type="button"
                    className="gs-ghost"
                    onClick={() => setShowDetail((v) => !v)}
                    aria-expanded={showDetail}
                  >
                    {showDetail ? "Hide details" : "Details"}
                  </button>
                </div>
              </div>

              <div className="gs-scroll" ref={scrollRef}>
                <div className="gs-scroll-inner">
                  {thread.length === 0 && (
                    <p className="gs-empty-line">
                      Nothing here yet. Your first message starts the thread.
                    </p>
                  )}

                  {thread.map((m, i) => {
                    const prev = thread[i - 1];
                    const newDay =
                      !prev || !sameDay(prev.created_at, m.created_at);

                    if (m.direction === "internal" || m.author === "system") {
                      return (
                        <div key={m.id}>
                          {newDay && <DayRule when={m.created_at} />}
                          <div className="gs-note">{m.body}</div>
                        </div>
                      );
                    }

                    const mine = m.direction === "outbound";
                    const who =
                      m.author === "staff"
                        ? staffName
                        : m.author === "assistant"
                        ? "Assistant"
                        : null;

                    return (
                      <div key={m.id}>
                        {newDay && <DayRule when={m.created_at} />}
                        <div
                          className={
                            "gs-msg" +
                            (mine ? " is-out" : " is-in") +
                            (m.author === "staff" ? " is-staff" : "")
                          }
                        >
                          <div className="gs-bubble">{m.body}</div>
                          <div className="gs-msg-meta">
                            {who && <span>{who}</span>}
                            <span>{clockTime(m.created_at)}</span>
                            {m.confidence === "low" && (
                              <span className="gs-low">low confidence</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COMPOSER */}
              <div className="gs-composer">
                {blocked ? (
                  <p className="gs-blocked">
                    This lead replied STOP. Messaging them is blocked until they
                    text START.
                  </p>
                ) : (
                  <>
                    <div className="gs-composer-row">
                      <textarea
                        className="gs-input"
                        rows={1}
                        placeholder={"Message " + displayName(selected)}
                        value={draft}
                        disabled={sending}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onComposerKey}
                      />
                      <button
                        type="button"
                        className="gs-send"
                        onClick={send}
                        disabled={sending || !draft.trim()}
                      >
                        {sending ? "Sending" : "Send"}
                      </button>
                    </div>

                    <div className="gs-composer-foot">
                      <span className="gs-hint">
                        Enter sends. Shift and Enter makes a new line.
                      </span>
                      <span className={"gs-chars" + (overLimit ? " is-over" : "")}>
                        {draft.length > 0 &&
                          (overLimit
                            ? draft.length + " characters, " + Math.ceil(draft.length / SEGMENT) + " texts"
                            : draft.length + "/" + SEGMENT)}
                      </span>
                    </div>

                    <div className="gs-error-slot" role="alert" aria-live="polite">
                      {error && <span className="gs-error">{error}</span>}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </main>

        { /* RIGHT DETAIL PANEL. */ }
        {selected && showDetail && (
          <aside className="gs-detail">
            <dl className="gs-facts">
              <Fact label="Number" value={selected.phone} />
              <Fact label="Came from" value={sourceLabel(selected.source)} />
              <Fact label="Stage" value={stageLabel(selected.stage)} />
              <Fact
                label="Last read as"
                value={selected.last_intent ? intentLabel(selected.last_intent) : "Not read yet"}
              />
              <Fact
                label="Texting consent"
                value={
                  selected.opted_out
                    ? "Opted out"
                    : selected.consent_to_sms
                    ? "On file"
                    : "Not on file"
                }
              />
              <Fact label="First contact" value={longDate(selected.created_at)} />
            </dl>

            {selected.human_required && (
              <div className="gs-detail-flag">
                The assistant stopped and asked for a person here. Reply, or hand
                it back once it's settled.
              </div>
            )}

            {selected.human_required && (
              <button
                type="button"
                className="gs-takeover"
                style={{ marginTop: 10 }}
                onClick={resolveHandoff}
                disabled={resolving}
              >
                {resolving ? "Marking resolved…" : "Mark resolved"}
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SMALL PIECES
--------------------------------------------------------------------------- */

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="gs-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DayRule({ when }: { when: string }) {
  return (
    <div className="gs-day">
      <span>{dayLabel(when)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   HELPERS
   Plain functions, no dependencies. Swap the date ones for date-fns or
   Intl.RelativeTimeFormat later if you want real localization.
--------------------------------------------------------------------------- */

function displayName(lead: Lead) {
  return lead.first_name?.trim() || lead.phone;
}

function initials(lead: Lead) {
  const n = lead.first_name?.trim();
  if (!n) return lead.phone.slice(-2);
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function previewOf(m: Message) {
  if (m.direction === "internal" || m.author === "system") return m.body;
  const prefix = m.direction === "outbound" ? (m.author === "staff" ? "You: " : "Assistant: ") : "";
  return prefix + m.body;
}

function lastActivity(list?: Message[]) {
  const last = list?.[list.length - 1];
  return last ? new Date(last.created_at).getTime() : 0;
}

function stageLabel(stage: Stage) {
  const map: Record<Stage, string> = {
    new: "New",
    contacted: "Contacted",
    engaged: "Talking",
    qualified: "Qualified",
    booked: "Booked",
    nurture: "Not now",
    closed: "Closed",
    do_not_contact: "Do not contact",
  };
  return map[stage] ?? stage;
}

function intentLabel(intent: string) {
  return intent.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function sourceLabel(source: string) {
  return source.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function longDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function shortAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  return days < 7 ? days + "d" : new Date(iso).toLocaleDateString([], { month: "numeric", day: "numeric" });
}

/* ===========================================================================
   STYLES
   Same palette as the login screen. Change the values at the top of .gs-root
   to restyle the whole page without touching any markup.
   =========================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&display=swap');

.gs-root {
  --paper:      #F5F4EF;  /* page, warm near-white */
  --card:       #FDFCF9;  /* panels, inbound bubbles. Warm, not pure white. */
  --ink:        #16241C;  /* primary text, dark work green */
  --ink-soft:   #4B5D53;  /* secondary text */
  --ink-dim:    #7B8A81;  /* tertiary text */
  --line:       #DEDCD3;  /* hairlines */
  --line-lit:   #C2BFB2;  /* hairlines on hover */

  --green:      #1E5138;  /* the accent, work polo green */
  --green-lit:  #2A6B4A;  /* accent on hover */
  --green-wash: #E7EFE9;  /* accent as a background tint */

  --flag:       #A06A12;  /* a person is needed here, and nothing else */
  --alert:      #A8412A;  /* something went wrong, and nothing else */

  --sink:       #E7E4DB;  /* the rail, clearly one step back from the page */

  --radius:     4px;
  --top-h:      56px;

  position: relative;
  height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Familjen Grotesk', system-ui, sans-serif;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.gs-root *,
.gs-root *::before,
.gs-root *::after { box-sizing: border-box; }

.gs-root button { font-family: inherit; }

/* ---------- atmosphere ---------- */

/* Enough grain that the flat off-white reads like paper rather than a swatch.
   It sits above everything and ignores pointer events, so it can't interfere. */
.gs-grain {
  position: absolute; inset: 0; pointer-events: none; z-index: 5;
  opacity: 0.030;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

/* ---------- header ---------- */

.gs-top {
  position: relative; z-index: 2;
  height: var(--top-h);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
}

.gs-mark {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
}
.gs-mark svg { color: var(--green); flex-shrink: 0; position: relative; top: -1px; }

.gs-waiting {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--flag);
}
.gs-waiting-clear { color: var(--ink-dim); font-weight: 400; }

.gs-dot-sun {
  width: 6px; height: 6px; border-radius: 50%; background: var(--flag);
}

/* ---------- shell ---------- */

.gs-body {
  position: relative; z-index: 1;
  display: flex;
  height: calc(100vh - var(--top-h));
  min-height: 0;
}

/* ---------- left rail ---------- */

.gs-rail {
  flex: 0 0 auto;
  min-width: 0;
  display: flex; flex-direction: column;
  background: var(--sink);
  overflow: hidden;
}

.gs-rail-head {
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--line);
}

.gs-search {
  width: 100%;
  padding: 8px 11px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  color: var(--ink);
  font-family: inherit;
  font-size: 13.5px;
}
.gs-search::placeholder { color: var(--ink-dim); }
.gs-search:focus { outline: none; border-color: var(--green); }

.gs-filters { display: flex; gap: 6px; margin-top: 10px; }

.gs-filter {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  background: none;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
  transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}
.gs-filter:hover { color: var(--ink); }
.gs-filter.is-on {
  color: var(--green);
  border-color: var(--green);
  background: var(--green-wash);
}

.gs-count {
  min-width: 17px; padding: 0 5px;
  border-radius: 999px;
  background: var(--flag);
  color: #FFFFFF;
  font-size: 11px; font-weight: 700; line-height: 17px; text-align: center;
}

.gs-list { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }

.gs-empty-rail {
  padding: 22px 12px; margin: 0;
  color: var(--ink-dim); font-size: 13px; line-height: 1.5;
}

.gs-row {
  position: relative;
  width: 100%;
  display: flex; align-items: flex-start; gap: 11px;
  padding: 10px;
  background: none; border: none; border-radius: var(--radius);
  color: inherit; text-align: left; cursor: pointer;
  transition: background 110ms ease;
}
.gs-row:hover { background: rgba(22, 36, 28, 0.045); }

/* The selected row lifts onto the page surface and gets a green edge, so it
   reads as the thing the center column is showing. */
.gs-row.is-on { background: var(--card); box-shadow: 0 1px 2px rgba(22, 36, 28, 0.07); }
.gs-row.is-on::before {
  content: '';
  position: absolute; left: 0; top: 6px; bottom: 6px;
  width: 2px; border-radius: 2px;
  background: var(--green);
}

.gs-avatar {
  position: relative; flex: 0 0 auto;
  width: 32px; height: 32px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--green-wash);
  border: 1px solid #D3E0D7;
  color: var(--green);
  font-size: 12px; font-weight: 600; letter-spacing: 0.01em;
}

/* The ring is drawn in whatever the row sits on, so the dot reads as a notch
   cut out of the avatar rather than a sticker sitting on top of it. */
.gs-avatar-flag {
  position: absolute; top: -1px; right: -1px;
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--flag);
  box-shadow: 0 0 0 2px var(--sink);
}
.gs-row.is-on .gs-avatar-flag { box-shadow: 0 0 0 2px var(--card); }

.gs-row-body { flex: 1; min-width: 0; display: block; }

.gs-row-top {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
}

.gs-row-name {
  font-size: 14px; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.gs-row-time { flex: 0 0 auto; font-size: 11.5px; color: var(--ink-dim); }

.gs-row-preview {
  display: block;
  margin-top: 2px;
  font-size: 13px; color: var(--ink-soft);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.gs-row-meta { display: block; margin-top: 6px; }

.gs-tag { font-size: 11.5px; color: var(--ink-dim); }
.gs-tag-sun { color: var(--flag); font-weight: 500; }
/* Opting out is a state, not a failure, so it stays neutral. */
.gs-tag-off { color: var(--ink-dim); }

/* Compact state, after the rail is dragged all the way in. */
.gs-rail.is-compact .gs-list { padding: 8px 0; }
.gs-rail.is-compact .gs-row { justify-content: center; padding: 7px 0; }
.gs-rail.is-compact .gs-row.is-on::before { display: none; }

/* ---------- drag handle ---------- */

.gs-handle {
  flex: 0 0 auto;
  width: 9px; margin: 0 -4px;
  position: relative; z-index: 3;
  cursor: col-resize;
  display: grid; place-items: center;
  background: none; border: none;
  touch-action: none;
}

.gs-handle-grip {
  width: 1px; height: 100%;
  background: var(--line);
  transition: background 120ms ease, width 120ms ease;
}
.gs-handle { background: var(--sink); }
.gs-handle:hover .gs-handle-grip,
.gs-handle.is-dragging .gs-handle-grip { width: 2px; background: var(--green); }

/* ---------- thread ---------- */

.gs-thread {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column;
  background: var(--paper);
  border-left: 1px solid var(--line);
}

.gs-thread-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 22px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
}

.gs-who-name {
  margin: 0;
  font-size: 17px; font-weight: 600; letter-spacing: -0.01em;
}
.gs-who-sub { margin: 2px 0 0; font-size: 12.5px; color: var(--ink-dim); }

.gs-controls { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

.gs-ai {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 13px; color: var(--ink-soft);
}
.gs-ai.is-paused { color: var(--flag); font-weight: 500; }

.gs-ai-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--green);
}
.gs-ai.is-paused .gs-ai-dot { background: var(--flag); }

.gs-takeover {
  padding: 6px 13px;
  background: none;
  border: 1px solid var(--line-lit);
  border-radius: 999px;
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.gs-takeover:hover {
  border-color: var(--green);
  color: var(--green);
  background: var(--green-wash);
}
.gs-takeover:disabled {
  opacity: 0.45;
  cursor: default;
  border-color: var(--line);
  color: var(--ink-dim);
  background: none;
}

.gs-ghost {
  background: none; border: none; padding: 0;
  color: var(--ink-dim); font-size: 13px; cursor: pointer;
  text-decoration: underline; text-underline-offset: 3px;
}
.gs-ghost:hover { color: var(--ink); }

.gs-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.gs-scroll-inner { max-width: 660px; margin: 0 auto; padding: 24px 22px 8px; }

.gs-day {
  display: flex; align-items: center; gap: 12px;
  margin: 20px 0 16px;
  color: var(--ink-dim); font-size: 12px;
}
.gs-day::before, .gs-day::after {
  content: ''; flex: 1; height: 1px; background: var(--line);
}

.gs-msg { display: flex; flex-direction: column; margin-bottom: 14px; }
.gs-msg.is-in { align-items: flex-start; }
.gs-msg.is-out { align-items: flex-end; }

.gs-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14.5px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
}

/* The customer. Plain paper. */
.gs-msg.is-in .gs-bubble {
  background: var(--card);
  border: 1px solid var(--line);
  border-bottom-left-radius: 4px;
}

/* The assistant. A light wash, because most of the thread is this and a column
   of heavy blocks is hard to scan. Alignment carries who said what. */
.gs-msg.is-out .gs-bubble {
  background: var(--green-wash);
  color: #1A4230;
  border: 1px solid #D3E0D7;
  border-bottom-right-radius: 4px;
}

/* A person typed this. Solid fill, because these are the rare ones and they're
   what staff scan a thread looking for. Weight carries the emphasis, not hue,
   which leaves amber free to mean one thing only. */
.gs-msg.is-staff .gs-bubble {
  background: var(--green);
  border-color: var(--green);
  color: #F1F5F1;
}

.gs-msg-meta {
  display: flex; gap: 8px;
  margin-top: 4px; padding: 0 3px;
  font-size: 11.5px; color: var(--ink-dim);
}

.gs-low { color: var(--alert); }

.gs-note {
  margin: 14px 0;
  padding-left: 13px;
  border-left: 2px solid var(--flag);
  color: var(--ink-soft);
  font-size: 12.5px; line-height: 1.55;
}

/* ---------- composer ---------- */

.gs-composer {
  background: var(--card);
  border-top: 1px solid var(--line);
  padding: 14px 22px 16px;
}

.gs-composer-row { display: flex; align-items: flex-end; gap: 10px; }

.gs-input {
  flex: 1;
  min-height: 42px; max-height: 160px;
  padding: 11px 13px;
  background: var(--card);
  border: 1px solid var(--line-lit);
  border-radius: var(--radius);
  color: var(--ink);
  font-family: inherit; font-size: 14.5px; line-height: 1.45;
  resize: vertical;
}
.gs-input::placeholder { color: var(--ink-dim); }
.gs-input:focus { outline: none; border-color: var(--green); }

.gs-send {
  flex: 0 0 auto;
  padding: 11px 20px;
  background: var(--green);
  color: #FFFFFF;
  border: none; border-radius: var(--radius);
  font-size: 14.5px; font-weight: 600;
  cursor: pointer;
  transition: background 130ms ease;
}
.gs-send:hover:not(:disabled) { background: var(--green-lit); }
.gs-send:disabled { opacity: 0.35; cursor: default; }

.gs-composer-foot {
  display: flex; justify-content: space-between; gap: 12px;
  margin-top: 7px;
  font-size: 11.5px; color: var(--ink-dim);
}
.gs-chars.is-over { color: var(--flag); font-weight: 500; }

.gs-error-slot { min-height: 18px; margin-top: 4px; }
.gs-error { color: var(--alert); font-size: 12.5px; }

.gs-blocked {
  margin: 0; padding: 12px 14px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-left: 2px solid var(--alert);
  border-radius: var(--radius);
  color: var(--ink-soft);
  font-size: 13px; line-height: 1.5;
}

/* ---------- detail panel ---------- */

.gs-detail {
  flex: 0 0 272px;
  background: var(--card);
  border-left: 1px solid var(--line);
  padding: 20px;
  overflow-y: auto;
}

.gs-facts { margin: 0; }

.gs-fact { margin-bottom: 16px; }
.gs-fact dt { font-size: 12px; color: var(--ink-dim); }
.gs-fact dd { margin: 3px 0 0; font-size: 14px; }

.gs-detail-flag {
  margin-top: 6px;
  padding-left: 13px;
  border-left: 2px solid var(--flag);
  color: var(--ink-soft);
  font-size: 12.5px; line-height: 1.55;
}

/* ---------- empty ---------- */

.gs-empty { flex: 1; display: grid; place-items: center; }
.gs-empty-line { color: var(--ink-dim); font-size: 14px; }

/* ---------- focus ---------- */

.gs-root :focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

/* ---------- scrollbars ---------- */

.gs-root ::-webkit-scrollbar { width: 9px; }
.gs-root ::-webkit-scrollbar-thumb {
  background: #CFCCC1; border-radius: 999px;
  border: 2px solid transparent; background-clip: content-box;
}
.gs-root ::-webkit-scrollbar-thumb:hover { background: #B4B0A2; background-clip: content-box; }

/* ---------- responsive ---------- */

@media (max-width: 1080px) {
  .gs-detail { display: none; }
}

@media (max-width: 760px) {
  /* The inline width from the drag has to be overridden here, which is the
     one place !important earns its keep in this file. */
  .gs-rail { width: 68px !important; }
  .gs-rail .gs-rail-head { display: none; }
  .gs-handle { display: none; }
  .gs-scroll-inner { padding: 18px 14px 6px; }
  .gs-composer { padding: 12px 14px 14px; }
  .gs-thread-head { padding: 12px 14px; flex-wrap: wrap; }
  .gs-bubble { max-width: 88%; }
}

@media (prefers-reduced-motion: reduce) {
  .gs-root * { transition: none !important; }
}
`;