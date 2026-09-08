import { useState } from "react";
import LeadButton from "../components/LeadButton";
import { fetchLeads, type Lead } from "../api/leads";

function LeadsPage() {
  const [message, setMessage] = useState<string>("No leads loaded yet");
  const [lead, setLeads] = useState<Lead | null>(null);

  function handleClick() {
    fetchLeads().then((data) => {
      setLeads(data);
      setMessage(`Loaded ${1} leads`);
    });
  }

  return (
    <div>
      <h1>Leads</h1>
      <p>{message}</p>
      <LeadButton label="Load Lead" onClick={handleClick} />

      {lead && (
        <p>
          {lead.first_name ?? "Unknown"} — {lead.phone} — {lead.stage}
        </p>
      )}
    </div>
  );
}

export default LeadsPage;