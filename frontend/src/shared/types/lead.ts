/* The shapes the backend sends for leads and their messages. Shared by the
   inbox, the dashboard and the live feed, so they live here instead of in a page. */

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
