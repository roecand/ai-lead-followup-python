import type { Lead, Stage, Author, Direction } from "../components/ConversationsPage";
import { apiFetch } from "./client";

/* ---------------------------------------------------------------------------
   SHAPES
   These are the shapes the dashboard renders. Make GET /dashboard/summary
   return exactly this and nothing else in the UI has to change.

   "Week" below means the last 7 days rolling, in the company's timezone, not
   Monday to Sunday. Rolling keeps the week-over-week comparison fair on a
   Monday morning.
--------------------------------------------------------------------------- */

export interface DashboardSummary {
  new_leads_today: number;
  /** Leads created in the last 7 days. */
  new_leads_week: number;
  /** Leads created in the 7 days before that. Drives the "3 more than last week" line. */
  new_leads_prev_week: number;
  /** 7 counts, oldest day first, today last. Drives the little bar chart. */
  new_leads_by_day: number[];

  /** Leads with at least one message in the last 7 days. */
  active_conversations: number;
  /** Leads where ai_paused is true (staff took over). */
  ai_paused_count: number;

  /**
   * Leads created in the last 7 days that are now in the booked stage.
   * Counted against that same group so "% of new leads" is an honest ratio.
   * There is no stage history table, so "booked this week" can't be measured yet.
   */
  booked_week: number;

  /** Outbound messages in the last 7 days, split by author. */
  ai_replies_week: number;
  staff_replies_week: number;

  /**
   * Median seconds from a lead's first inbound text to the next outbound
   * message, over leads whose first text landed in the last 7 days.
   * null when there were none. This is the speed-to-lead number.
   */
  first_reply_seconds: number | null;
}

export interface HandoffItem {
  lead: Lead;
  /**
   * Why the assistant asked for a person. There is no column for this yet.
   * Lead only has last_intent, so either add a human_reason column or send
   * null here and the UI falls back to last_intent.
   */
  reason: string | null;
  /** When the lead was flagged. updated_at is close enough for now. */
  waiting_since: string;
}

export interface FollowUpItem {
  id: string;
  lead_id: string;
  lead_name: string;
  due_at: string;
  reason: string;
  /** "pending" is all the UI shows. Filter the rest out server side. */
  status: string;
}

export interface RecentItem {
  lead: Lead;
  last_message: {
    body: string;
    author: Author;
    direction: Direction;
    created_at: string;
  } | null;
}

export interface DashboardData {
  summary: DashboardSummary;
  /** Count of leads per stage. Missing stages are treated as 0. */
  stage_counts: Partial<Record<Stage, number>>;
  handoffs: HandoffItem[];
  followups: FollowUpItem[];
  recent: RecentItem[];
}

/* ---------------------------------------------------------------------------
   FETCH
   Flip USE_MOCK to false once GET /dashboard/summary exists.
--------------------------------------------------------------------------- */

const USE_MOCK = false;

export async function fetchDashboard(): Promise<DashboardData> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350)); // so the loading state is visible
    return mockDashboard();
  }

  const res = await apiFetch("/dashboard/summary");
  if (!res.ok) throw new Error("Failed to load dashboard");
  return res.json();
}

/* ---------------------------------------------------------------------------
   MOCK DATA
   Times are relative to now so the page always looks current. Delete this
   whole section when the real endpoint is wired up.
--------------------------------------------------------------------------- */

const minsAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const minsFromNow = (m: number) => new Date(Date.now() + m * 60000).toISOString();

function mockLead(over: Partial<Lead> & Pick<Lead, "id" | "first_name" | "phone">): Lead {
  return {
    source: "website_form",
    stage: "engaged",
    consent_to_sms: true,
    opted_out: false,
    human_required: false,
    last_intent: null,
    created_at: minsAgo(60 * 24 * 3),
    ai_paused: false,
    ...over,
  };
}

function mockDashboard(): DashboardData {
  const dana = mockLead({
    id: "l1", first_name: "Dana Ortiz", phone: "+17025550141",
    stage: "qualified", human_required: true, last_intent: "pricing",
  });
  const marcus = mockLead({
    id: "l2", first_name: "Marcus Bell", phone: "+17025550188",
    stage: "engaged", human_required: true, last_intent: "emergency",
  });
  const priya = mockLead({
    id: "l3", first_name: "Priya Shah", phone: "+17025550107",
    stage: "engaged", ai_paused: true,
  });
  const tom = mockLead({
    id: "l4", first_name: "Tom Reyes", phone: "+17025550163", stage: "booked",
  });
  const omar = mockLead({
    id: "l6", first_name: "Omar Haddad", phone: "+17025550175", stage: "new",
  });

  return {
    summary: {
      new_leads_today: 4,
      new_leads_week: 17,
      new_leads_prev_week: 14,
      new_leads_by_day: [2, 3, 1, 0, 4, 3, 4],
      active_conversations: 23,
      ai_paused_count: 3,
      booked_week: 5,
      ai_replies_week: 142,
      staff_replies_week: 19,
      first_reply_seconds: 38,
    },
    stage_counts: {
      new: 12, contacted: 18, engaged: 23, qualified: 9,
      booked: 14, nurture: 7, closed: 31,
    },
    handoffs: [
      { lead: marcus, reason: "Mentioned no cooling and an elderly resident at home", waiting_since: minsAgo(14) },
      { lead: dana, reason: "Asked for a firm price on a full system replacement", waiting_since: minsAgo(95) },
    ],
    followups: [
      { id: "f1", lead_id: "l6", lead_name: "Omar Haddad", due_at: minsFromNow(40), reason: "Check in on quote request", status: "pending" },
      { id: "f2", lead_id: "l5", lead_name: "+17025550122", due_at: minsFromNow(60 * 4), reason: "No reply to first message", status: "pending" },
      { id: "f3", lead_id: "l3", lead_name: "Priya Shah", due_at: minsFromNow(60 * 22), reason: "Confirm diagnostic visit", status: "pending" },
      { id: "f4", lead_id: "l4", lead_name: "Tom Reyes", due_at: minsFromNow(60 * 50), reason: "Post visit check in", status: "pending" },
    ],
    recent: [
      { lead: marcus, last_message: { body: "It's 94 in here and my mom is home. Can someone come today?", author: "customer", direction: "inbound", created_at: minsAgo(14) } },
      { lead: omar, last_message: { body: "Thanks for reaching out. Happy to help with a quote, what kind of system do you have now?", author: "assistant", direction: "outbound", created_at: minsAgo(38) } },
      { lead: dana, last_message: { body: "So what would a full replacement run me?", author: "customer", direction: "inbound", created_at: minsAgo(95) } },
      { lead: priya, last_message: { body: "I can do Thursday morning. Does 9 work?", author: "staff", direction: "outbound", created_at: minsAgo(60 * 3) } },
      { lead: tom, last_message: { body: "Great, see you Friday.", author: "customer", direction: "inbound", created_at: minsAgo(60 * 26) } },
    ],
  };
}
