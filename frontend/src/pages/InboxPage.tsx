import { useEffect, useState } from "react";
import type { Lead, Message } from "../components/ConversationsPage";
import ConversationsPage from "../components/ConversationsPage";
import { apiFetch } from "../api/client";

interface Me {
  user_id: string;
  email: string;
  company_id: string;
}


export default function InboxPage() {
  const [user, setUser] = useState<Me | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messagesByLead, setMessagesByLead] = useState<Record<string, Message[]>>({});
  const [pendingAiToggle, setPendingAiToggle] = useState<Set<string>>(new Set());

  // Get current logged in user
  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => res.json())
      .then(setUser);
  }, []);

  // Pull the user's company's leads
  useEffect(() => {
    if (!user) return;
    apiFetch('/company/leads')
      .then((res) => res.json())
      .then(setLeads);
  }, [user]);


  async function loadThread(leadId: string) {
    if (messagesByLead[leadId]) return; // Lead messages already loaded
    const res = await apiFetch(`/leads/${leadId}/messages`);
    const messages = await res.json();
    setMessagesByLead((prev) => ({...prev, [leadId]: messages }))
  }

  // Need to run loadThread initially to pull the messages of the first lead selected by defualt.
  useEffect(() => {
  if (leads.length === 0) return;
  const firstId = leads[0].id;
  if (messagesByLead[firstId]) return;

  apiFetch(`/leads/${firstId}/messages`)
    .then((res) => res.json())
    .then((messages) => {
      setMessagesByLead((prev) => ({ ...prev, [firstId]: messages }));
    });
}, [leads]);


  // 3
  async function toggleAi({ leadId, paused }: { leadId: string; paused: boolean }) {
    if (pendingAiToggle.has(leadId)) return; // already mid-toggle, ignore click

    setPendingAiToggle((prev) => new Set(prev).add(leadId));

    setLeads((prev) =>
      prev.map((lead) => (lead.id === leadId ? { ...lead, ai_paused: paused } : lead))
    );
    try {
      await apiFetch(`/leads/${leadId}/ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
    } catch {
      // Request failed - revert the UI back to what it actually was
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, ai_paused: !paused } : lead))
      );
    } finally {
      setPendingAiToggle((prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      }));
    }
  }

  // 4
  async function sendMessage({ leadId, body }: {leadId: string, body: string }){
    if(!messagesByLead[leadId]) return; // lead messages not loaded yet. unlikely to happen, but safety check
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage: Message = {
      id: tempId,
      lead_id: leadId,
      direction: "outbound",
      author: "staff",
      body: body,
      intent: null,
      confidence: null,
      created_at: new Date().toISOString(),
    }
    setMessagesByLead((prev) => ({...prev, [leadId]:[ ...(prev[leadId] ?? []), optimisticMessage ] }));

    const wasAiPaused = leads.find((l) => l.id === leadId)?.ai_paused ?? false;
    const human_required = !wasAiPaused ?
        leads.find((l) => l.id === leadId)?.human_required ?? false :
        false; // Don't waste compute on find if ai was already paused

    if (!wasAiPaused) {
      setLeads((prev) =>
          prev.map((lead) => (lead.id === leadId ? { ...lead, ai_paused: true, human_required: false} : lead))
      );
    }

    try {
      const res = await apiFetch(`/leads/${leadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Send failed");
    } catch {
      setMessagesByLead((prev) => ({
            ...prev,
            [leadId]: (prev[leadId] ?? []).filter((m) => m.id !== tempId )}),
      );

      if (!wasAiPaused) {
        setLeads((prev) =>
            prev.map((lead) => (lead.id === leadId ? { ...lead, ai_paused: false, human_required: human_required} : lead))
        );
      }

      throw new Error("Message failed to send. Check connection and try again");
    }
  }


  return <ConversationsPage
      leads={leads}
      messagesByLead={messagesByLead}
      onSelectLead={loadThread}
      onToggleAi={toggleAi}
      pendingAiToggles={pendingAiToggle}
      onSendMessage={sendMessage}
  />;
}