import { lazy, Suspense, useEffect, useId, useState, type FormEvent } from "react";
import { SECURITY_CSS } from "./securityStyles";
import { disableTotp, fetchTwoFactorMethod, TwoFactorError, type TwoFactorMethod } from "./twoFactor";

/**
 * Settings > Security. Shows whether two-step sign-in is on, and lets the
 * person turn an authenticator app on (same flow as sign-up) or off.
 * Turning it off asks for a current code, so someone who only has a
 * signed-in browser can't quietly remove it.
 */

// Loaded only when someone starts setup, so the QR code library stays out of the main bundle.
const TotpSetup = lazy(() => import("./TotpSetup"));

type View = "status" | "setup" | "disable";

const STATUS_TEXT: Record<TwoFactorMethod, string> = {
  totp: "When you sign in, we ask for the 6-digit code from your authenticator app.",
  email: "When you sign in, we email you a code. An authenticator app is faster and works without email.",
  none: "Sign-in only asks for your password. With an authenticator app, a stolen password isn't enough to get in.",
};

const BADGE: Record<TwoFactorMethod, string> = { totp: "On", email: "Email codes", none: "Off" };

export default function SecurityPanel() {
  const [method, setMethod] = useState<TwoFactorMethod | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState<View>("status");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchTwoFactorMethod()
      .then((m) => {
        if (!cancelled) setMethod(m);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retryLoad() {
    setLoadError(false);
    setReloadKey((k) => k + 1);
  }

  // After a change, get the new status first and only then switch back, so
  // the badge never shows the old state next to the new message.
  async function finishChange(message: string) {
    try {
      setMethod(await fetchTwoFactorMethod());
    } catch {
      // Keep what's shown. The message still says what happened.
    }
    setNotice(message);
    setView("status");
  }

  return (
    <div className="st-field tf">
      <style>{SECURITY_CSS}</style>
      <p className="st-field-label">Two-step sign-in</p>

      {loadError ? (
        <>
          <p className="tf-msg is-error" role="alert">Couldn't load this. Check your connection and try again.</p>
          <div className="tf-actions">
            <button type="button" className="gs-btn" onClick={retryLoad}>Try again</button>
          </div>
        </>
      ) : method === null ? (
        <p className="tf-text">Checking</p>
      ) : view === "setup" ? (
        <Suspense fallback={<p className="tf-text">Loading</p>}>
          <TotpSetup
            onEnabled={() => setMethod("totp")}
            onDone={() => void finishChange("Your authenticator app is on.")}
            doneLabel="Done"
            onCancel={() => setView("status")}
          />
        </Suspense>
      ) : (
        <>
          <div className="tf-status">
            <span className={"tf-badge" + (method === "totp" ? " is-on" : "")}>{BADGE[method]}</span>
            <p className="tf-text">{STATUS_TEXT[method]}</p>
          </div>

          {view === "disable" ? (
            <DisableForm onCancel={() => setView("status")} onDone={() => finishChange("Two-step sign-in with your app is off.")} />
          ) : (
            <>
              {notice ? <p className="tf-msg is-ok" role="status">{notice}</p> : null}
              <div className="tf-actions">
                {method === "totp" ? (
                  <button type="button" className="gs-btn" onClick={() => { setNotice(""); setView("disable"); }}>
                    Turn off
                  </button>
                ) : (
                  <button type="button" className="tf-primary" onClick={() => { setNotice(""); setView("setup"); }}>
                    Set up authenticator app
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function DisableForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => Promise<void> }) {
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const value = code.replace(/\s+/g, "");
    if (!value || busy) return;

    setBusy(true);
    setError("");
    try {
      await disableTotp(value);
    } catch (err) {
      setBusy(false);
      setCode("");
      if (!(err instanceof TwoFactorError)) return setError("Couldn't reach the server. Check your connection and try again.");
      if (err.status === 401) return;
      if (err.status === 429) return setError("Too many tries. Wait a few minutes, then try again.");
      setError("That code didn't work. Use the one showing in your app now, or a recovery code you haven't used.");
      return;
    }
    // Stays on "Turning off" until the panel has the new status.
    await onDone();
  }

  return (
    <form className="tf-form tf-disable" onSubmit={handleSubmit} noValidate>
      <label className="tf-label" htmlFor={inputId}>Code from your app, or a recovery code</label>
      <input
        id={inputId}
        className="tf-input"
        type="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={24}
        value={code}
        disabled={busy}
        autoFocus
        onChange={(e) => {
          setCode(e.target.value);
          if (error) setError("");
        }}
      />
      <p className={"tf-msg" + (error ? " is-error" : "")} role="alert" aria-live="polite">{error}</p>
      <div className="tf-actions">
        <button type="submit" className="tf-danger" disabled={busy || !code.trim()}>
          {busy ? "Turning off" : "Turn off"}
        </button>
        <button type="button" className="gs-btn" onClick={onCancel} disabled={busy}>Keep it on</button>
      </div>
    </form>
  );
}
