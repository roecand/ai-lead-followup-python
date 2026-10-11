import { useCallback, useEffect, useRef, useState } from "react";
import DashboardView from "../components/DashboardView";
import { fetchDashboard } from "../lib/dashboard";
import type { DashboardData } from "../lib/dashboard";
import { useLiveFeed } from "../lib/useLiveFeed";

/**
 * Loads the dashboard and hands it to the view. All the data plumbing lives in
 * lib/dashboard.ts, so hooking up the backend is a change to that one file.
 *
 * Stays current two ways: a quiet refetch shortly after any new message on the
 * websocket, and a re-render every 30s so "14m ago" style labels keep moving.
 */
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);

  // First load, and again after "Try again".
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

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Background refresh. If it fails, keep what's on screen instead of blanking it.
  const refresh = useCallback(() => {
    fetchDashboard().then(setData).catch(() => {});
  }, []);

  // Messages tend to arrive in bursts (customer text, then the assistant's
  // reply), so wait a beat and refetch once.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(refreshTimer.current), []);
  const live = useLiveFeed((event) => {
    if (event.type !== "new_message") return;
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(refresh, 800);
  });

  function retry() {
    setError("");
    setData(null);
    setReloadKey((k) => k + 1);
  }

  return <DashboardView data={data} error={error} onRetry={retry} live={live} />;
}
