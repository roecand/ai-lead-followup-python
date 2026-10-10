import type { Lead, Stage } from "../components/ConversationsPage";

/** Order the funnel is drawn in. do_not_contact is left out on purpose. */
export const FUNNEL_STAGES: Stage[] = [
  "new",
  "contacted",
  "engaged",
  "qualified",
  "booked",
  "nurture",
  "closed",
];

export function stageLabel(stage: Stage): string {
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

export function displayName(lead: Pick<Lead, "first_name" | "phone">): string {
  return lead.first_name?.trim() || lead.phone;
}

export function initials(lead: Pick<Lead, "first_name" | "phone">): string {
  const n = lead.first_name?.trim();
  if (!n) return lead.phone.slice(-2);
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function intentLabel(intent: string): string {
  return intent.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** "now", "5m", "3h", "2d" */
export function shortAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  return days < 7
    ? days + "d"
    : new Date(iso).toLocaleDateString([], { month: "numeric", day: "numeric" });
}

/** "Waiting 2h", used on the needs attention list. */
export function waitingLabel(iso: string): string {
  const ago = shortAgo(iso);
  return ago === "now" ? "Just now" : "Waiting " + ago;
}

/** When a follow-up is due, in words. */
export function dueLabel(iso: string): string {
  const due = new Date(iso);
  const diffMins = Math.round((due.getTime() - Date.now()) / 60000);
  if (diffMins < 0) return "Overdue";
  if (diffMins < 60) return "In " + Math.max(diffMins, 1) + "m";

  const time = due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (due.toDateString() === today.toDateString()) return "Today " + time;
  if (due.toDateString() === tomorrow.toDateString()) return "Tomorrow " + time;
  return due.toLocaleDateString([], { weekday: "short" }) + " " + time;
}

/** Turns a message into a one line preview with a who-said-it prefix. */
export function previewOf(m: {
  body: string;
  direction: string;
  author: string;
}): string {
  if (m.direction === "internal" || m.author === "system") return m.body;
  if (m.direction === "outbound") {
    return (m.author === "staff" ? "You: " : "Assistant: ") + m.body;
  }
  return m.body;
}
/** "38 sec", "4 min", "1.5 hr". Used for reply times. */
export function durationLabel(seconds: number): string {
  if (seconds < 90) return Math.max(1, Math.round(seconds)) + " sec";
  const mins = seconds / 60;
  if (mins < 90) return Math.round(mins) + " min";
  return (mins / 60).toFixed(1) + " hr";
}

export function sourceLabel(source: string): string {
  return source.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
