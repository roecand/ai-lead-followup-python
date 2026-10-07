import type { Lead, Message, Stage } from "../components/ConversationsPage";

// Preview data for /dashboard?demo=1. Only used when the query flag is present,
// so the page can be reviewed without a running backend or a login.

const now = Date.now();
const ago = (min: number) => new Date(now - min * 60_000).toISOString();

function lead(
  id: string,
  first_name: string,
  phone: string,
  source: string,
  stage: Stage,
  createdMinAgo: number,
  extra: Partial<Lead> = {},
): Lead {
  return {
    id,
    first_name,
    phone,
    source,
    stage,
    consent_to_sms: true,
    opted_out: false,
    human_required: false,
    last_intent: null,
    created_at: ago(createdMinAgo),
    ai_paused: false,
    ...extra,
  };
}

export const DEMO_COMPANY = "Summit Climate Solutions";

export const demoLeads: Lead[] = [
  lead("l1", "Dolores", "+17025550148", "Google Ads", "engaged", 190, {
    human_required: true,
    last_intent: "emergency_service",
  }),
  lead("l2", "Marcus", "+17025550163", "Website form", "qualified", 420, {
    human_required: true,
    last_intent: "pricing_dispute",
  }),
  lead("l3", "Priya", "+17025550117", "Yelp", "booked", 1500, { last_intent: "booking" }),
  lead("l4", "Hector", "+17025550192", "Referral", "engaged", 95, { last_intent: "financing_question" }),
  lead("l5", "Beth", "+17025550174", "Website form", "contacted", 50),
  lead("l6", "Tran", "+17025550129", "Google Ads", "new", 12),
  lead("l7", "Walt", "+17025550136", "Thumbtack", "nurture", 4300, { last_intent: "not_now" }),
  lead("l8", "Imani", "+17025550185", "Google Ads", "booked", 2900, { last_intent: "booking" }),
  lead("l9", "Rob", "+17025550101", "Website form", "closed", 9000),
  lead("l10", "Alma", "+17025550158", "Yelp", "engaged", 260, { ai_paused: true }),
  lead("l11", "Dev", "+17025550140", "Referral", "qualified", 640, { last_intent: "quote_request" }),
  lead("l13", "Gil", "+17025550121", "Google Ads", "closed", 11500),
  lead("l14", "Mae", "+17025550133", "Referral", "booked", 12800),
  lead("l15", "Omar", "+17025550177", "Yelp", "nurture", 15200),
  lead("l16", "Jun", "+17025550182", "Website form", "contacted", 2200),
  lead("l17", "Ruth", "+17025550109", "Google Ads", "engaged", 5600),
  lead("l12", "Noor", "+17025550166", "Website form", "do_not_contact", 7000, { opted_out: true }),
];

function m(
  id: string,
  lead_id: string,
  author: Message["author"],
  body: string,
  minAgo: number,
  intent: string | null = null,
): Message {
  return {
    id,
    lead_id,
    direction: author === "customer" ? "inbound" : "outbound",
    author,
    body,
    intent,
    confidence: null,
    created_at: ago(minAgo),
  };
}

export const demoMessages: Record<string, Message[]> = {
  l1: [
    m("m1", "l1", "customer", "Our AC just died and it's 104 out. Can someone come today?", 11, "emergency_service"),
    m("m2", "l1", "assistant", "I'm sorry, that's miserable. I'm flagging this to dispatch right now so a person can confirm timing with you.", 10),
  ],
  l2: [
    m("m3", "l2", "customer", "The last guy quoted me $400 less. Why is yours higher?", 33, "pricing_dispute"),
    m("m4", "l2", "assistant", "Fair question. I can't speak to another quote, so I've asked a technician to call you and walk through ours.", 32),
  ],
  l3: [
    m("m5", "l3", "customer", "Thursday morning works.", 140, "booking"),
    m("m6", "l3", "assistant", "Booked for Thursday between 8 and 10 AM. You'll get a text when the technician is on the way.", 139),
  ],
  l4: [
    m("m7", "l4", "customer", "Do you finance a full system replacement?", 18, "financing_question"),
    m("m8", "l4", "assistant", "Yes, financing is available subject to lender approval. Want me to send the application link?", 17),
  ],
  l5: [
    m("m9", "l5", "assistant", "Hi Beth, this is Summit Climate. Thanks for requesting a tune-up quote. When are you free this week?", 46),
  ],
  l6: [
    m("m10", "l6", "assistant", "Hi Tran, thanks for reaching out about a mini-split install. Is this for a single room or the whole house?", 8),
    m("m11", "l6", "customer", "Garage conversion, about 400 sq ft", 5),
    m("m12", "l6", "assistant", "That's a good fit for one ductless unit. A tech can measure and give a firm number. Mornings or afternoons?", 4),
  ],
  l10: [
    m("m13", "l10", "customer", "Can you just call me instead?", 130),
    m("m14", "l10", "staff", "Calling you now, Alma.", 128),
  ],
  l11: [
    m("m15", "l11", "customer", "Looking for a quote on a 3-ton heat pump.", 75, "quote_request"),
    m("m16", "l11", "assistant", "Happy to help. A diagnostic visit is $89 and credited toward any approved repair or install. Does Friday work?", 74),
  ],
};
