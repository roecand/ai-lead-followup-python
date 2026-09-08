const BASE_URL = "http://localhost:8000";

export type LeadStage =
  | "new" | "contacted" | "engaged" | "qualified"
  | "booked" | "nurture" | "closed" | "do_not_contact";

export type Lead = {
  id: number;
  phone: string;
  first_name: string | null;
  source: string;
  stage: LeadStage;
  consent_to_sms: boolean;
  opted_out: boolean;
  human_required: boolean;
  last_intent: string | null;
  created_at: string;
};

export async function fetchLeads(): Promise<Lead> {
  const res = await fetch(`${BASE_URL}/leads/${1}`);
  if (!res.ok) throw new Error(`Lead not found: ${res.status}`);
  return res.json();
}


export async function createLead(lead: {
  phone: string;
  first_name?: string;
  source?: string;
  consent_to_sms?: boolean;
}): Promise<Lead> {
  const res = await fetch(`${BASE_URL}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  return res.json();
}