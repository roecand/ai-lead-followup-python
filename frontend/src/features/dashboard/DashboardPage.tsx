import { useCallback, useEffect, useRef, useState } from "react";
import DashboardView from "./DashboardView";
import { claimPrefetchedDashboard, fetchDashboard } from "./dashboard";
import type { DashboardData } from "./dashboard";
import { useLiveFeed } from "../../shared/hooks/useLiveFeed";

export default function DashboardPage() {
  // Coming from sign-up, the data may already be here, so show it on the first frame.
  const [data, setData] = useState<DashboardData | null>(() => claimPrefetchedDashboard()?.data ?? null);
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const [reloadKey, setReloadKey] = useState(0);

  // First load, and again after "Try again". The first load reuses a
  // prefetch from sign-up if there is one. "Try again" always asks fresh.
  useEffect(() => {
    let cancelled = false;
    const pre = reloadKey === 0 ? claimPrefetchedDashboard() : null;
    if (pre?.data) return;

    (pre?.promise ?? fetchDashboard())
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
