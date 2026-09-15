import { useEffect, useState } from "react";
import type { Lead } from "../components/ConversationsPage";
import ConversationsPage from "../components/ConversationsPage";

export default function InboxPage() {
  const companyId = 1; // TODO: replace with the logged-in user's actual company id
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    fetch(`/companies/${companyId}/leads`)
      .then((res) => res.json())
      .then(setLeads);
  }, []);

  return <ConversationsPage leads={leads} />;
}