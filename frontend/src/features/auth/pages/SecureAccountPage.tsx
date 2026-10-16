import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { prefetchDashboard } from "../../dashboard/dashboard";
import { SECURITY_CSS } from "../../security/securityStyles";
import { JoinSteps } from "../components/AuthChrome";
import { playArrival } from "../arrival";

// Loaded only when someone picks setup, so the QR code library stays out of the main bundle.
const TotpSetup = lazy(() => import("../../security/TotpSetup"));

/**
 * Step after verify. The account exists and they're signed in, so this offers
 * an authenticator app before they reach the dashboard. It's optional, and
 * "Not now" goes straight on. The same setup lives in Settings > Security.
 *
 * The steps panel shows the first three steps done and the last one dimmed
 * as up next, since this page sits between steps. Finishing checks the last
 * step, then the arrival splash carries them into the dashboard. The
 * dashboard starts loading as soon as this page opens, so it's ready by then.
 *
 * How people get here
 *   - Verify succeeds:  navigate(SECURE_ACCOUNT_PATH, { replace: true, state: { fromVerify: true } })
 *   - Anyone else who opens /secure is sent to Settings > Security, which
 *     has the same setup without the sign-up framing. Signed out, AuthShell
 *     sends them to sign in first.
 */

// Long enough for the last step's check to draw before the sun rises.
const CHECK_MS = 650;

export default function SecureAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromVerify = Boolean((location.state as { fromVerify?: boolean } | null)?.fromVerify);

  const [settingUp, setSettingUp] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (fromVerify) void prefetchDashboard().catch(() => {});
  }, [fromVerify]);

  if (!fromVerify) return <Navigate to="/settings/security" replace />;

  async function finish() {
    if (finishing) return;
    setFinishing(true);

    // The steps panel is hidden on narrow screens, so there's no check to wait for there.
    const stepsVisible = window.matchMedia("(min-width: 981px)").matches;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (stepsVisible && !reduceMotion) await new Promise((r) => window.setTimeout(r, CHECK_MS));

    void playArrival({
      onCovered: () => navigate("/dashboard", { replace: true }),
      ready: prefetchDashboard(),
    });
  }

  return (
    <main className="lf-stage">
      <style>{SECURITY_CSS}</style>

      <section className="lf-story" aria-label="How joining works">
        <h1 className="lf-headline">You're in.</h1>
        <p className="lf-sub">
          Your email is confirmed and your account is ready. One optional step, then your inbox.
        </p>
        <JoinSteps current={3} between={!finishing} allDone={finishing} />
      </section>

      <div className="lf-card lf-card-compact">
        {settingUp ? (
          <Suspense fallback={<p className="lf-sent">Loading</p>}>
            <TotpSetup
              titleClassName="lf-card-title"
              onDone={finish}
              doneLabel="Go to your dashboard"
              onCancel={() => setSettingUp(false)}
              cancelLabel="Back"
            />
          </Suspense>
        ) : (
          <>
            <span className="lf-mail-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5.5c0 4.2-2.9 7.8-7 9.5-4.1-1.7-7-5.3-7-9.5V6l7-3z" />
                <path d="M9 12l2.2 2.2L15.5 10" />
              </svg>
            </span>

            <h2 className="lf-card-title">Protect your account</h2>
            <p className="lf-sent">
              Add a code from an authenticator app, like Google Authenticator, to your sign-in.
              If someone learns your password, they still can't get in without your phone.
            </p>

            <button type="button" className="lf-submit" onClick={() => setSettingUp(true)} disabled={finishing}>
              Set up authenticator app
            </button>

            <p className="lf-foot">
              <button type="button" className="lf-reveal" onClick={finish} disabled={finishing}>
                {finishing ? "Opening your dashboard" : "Not now"}
              </button>
              <span className="lf-secure-later">You can turn it on later in Settings, under Security.</span>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
