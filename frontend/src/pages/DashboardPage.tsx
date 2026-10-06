import { useEffect, useState } from "react";
import DashboardView from "../components/DashboardView";
import { fetchDashboard } from "../lib/dashboard";
import type { DashboardData } from "../lib/dashboard";

/**
 * Loads the dashboard and hands it to the view. All the data plumbing lives in
 * api/dashboard.ts, so hooking up the backend is a change to that one file.
 */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    fetchDashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the dashboard. Check your connection and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retry() {
    setError("");
    setData(null);
    setReloadKey((k) => k + 1);
  }

  return <DashboardView data={data} error={error} onRetry={retry} />;
}