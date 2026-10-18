import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../../../shared/api/client";

/**
 * Second step of sign-in. The password was right, now the person proves
 * it's them with a code.
 *
 * How people get here
 *   - LoginPage gets a 200 from /auth/login:  navigate(LOGIN_CODE_PATH, { state: { method } })
 * React Router keeps that state through a page refresh. Someone who opens
 * this page directly has no method, so they're pointed back to sign in.
 *
 * The login challenge itself never touches this code. The backend set it
 * as an HttpOnly cookie scoped to /auth/login/2fa, so the browser sends it
 * with the requests below on its own.
 *
 * Backend contract. Change the paths here if yours differ.
 *   POST CODE_PATH      { code }  -> 204 and sets the auth cookies
 *   POST RECOVERY_PATH  { code }  -> 204 and sets the auth cookies
 *   Both answer
 *     400  wrong code
 *     410  challenge missing or expired, sign in again
 *     429  too many tries
 *     501  this kind of code isn't available yet
 *
 *   POST RESEND_PATH    (no body) -> 204, a new email code is on its way
 *     410  challenge missing or expired, sign in again
 *     429  cooldown or hourly limit, the response detail says which
 *     502  the email couldn't be sent
 *   Only email users see the resend button.
 */
const CODE_PATH = "/auth/login/2fa";
const RECOVERY_PATH = "/auth/login/2fa/recovery";
const RESEND_PATH = "/auth/login/2fa/resend";

const CODE_LENGTH = 6;
// Recovery codes look like "a1b2c3d4e5-f6a7b8c9d0", 20 characters without the dash.
const RECOVERY_HALF = 10;
const RECOVERY_LENGTH = RECOVERY_HALF * 2;
const RESEND_COOLDOWN_S = 30;

export type LoginCodeMethod = "totp" | "email";

const COPY: Record<LoginCodeMethod, { title: string; sent: string; label: string }> = {
  totp: {
    title: "Enter your app code",
    sent: "Open your authenticator app and enter the 6-digit code for Meridiem.",
    label: "Authenticator code",
  },
  email: {
    title: "Check your email",
    sent: "We emailed you a 6-digit code. It expires in 5 minutes.",
    label: "Email code",
  },
};

export default function LoginCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const method = (location.state as { method?: LoginCodeMethod } | null)?.method;
  const known = method === "totp" || method === "email";

  // Authenticator users who lost their phone can use a recovery code instead.
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The backend dropped the challenge (410), so the password step has to run again.
  const [expired, setExpired] = useState(false);
  const [notice, setNotice] = useState("");

  // A code was just emailed when they arrived, so the cooldown starts right away.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resending, setResending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Put the cursor back in the box whenever a check finishes or the mode changes.
  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy, recovery]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const ready = recovery ? code.length === RECOVERY_LENGTH : code.length === CODE_LENGTH;

  function handleChange(raw: string) {
    // App and email codes keep digits only, so "123 456" still works.
    // Recovery codes keep letters and digits and drop the dash.
    const cleaned = recovery
      ? raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, RECOVERY_LENGTH)
      : raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(cleaned);
    if (error) setError("");
  }

  async function resend() {
    if (cooldown > 0 || resending || busy) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}${RESEND_PATH}`, {
        method: "POST",
        credentials: "include",
      });
      if (response.ok) {
        setNotice("A new code is on its way. Earlier codes no longer work.");
        setCode("");
        // Only a real send starts the wait, to match the backend.
        setCooldown(RESEND_COOLDOWN_S);
        inputRef.current?.focus({ preventScroll: true });
      } else if (response.status === 410) {
        setExpired(true);
      } else if (response.status === 429) {
        // Two reasons share this status (cooldown and the hourly limit), so show the server's own wording.
        const data = await response.json().catch(() => null);
        setError(typeof data?.detail === "string"
          ? data.detail
          : "You asked for a code a moment ago. Give it a minute.");
        setCooldown(RESEND_COOLDOWN_S);
      } else if (response.status === 404 || response.status === 501) {
        setError("Resending isn't available yet. Go back and sign in again for a new code.");
      } else {
        // The send failed (502 or similar). No wait, they can try again right away.
        setError("Couldn't send a new code. Try again.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  function switchMode() {
    setRecovery((r) => !r);
    setCode("");
    setError("");
    setNotice("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!ready) {
      setError(recovery ? "Enter the full recovery code." : `Enter the ${CODE_LENGTH}-digit code.`);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}${recovery ? RECOVERY_PATH : CODE_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        navigate("/dashboard", { replace: true });
        return;
      }
      if (response.status === 410) {
        setExpired(true);
        setBusy(false);
        return;
      }
      if (response.status === 429) {
        throw new Error("Too many tries. Wait a few minutes, then sign in again.");
      }
      if (response.status === 404 || response.status === 501) {
        throw new Error(
          recovery
            ? "Recovery codes can't be used to sign in yet."
            : "Email codes aren't available yet.",
        );
      }
      throw new Error(recovery ? "That recovery code didn't work." : "That code didn't match. Try the newest one.");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch"
        ? err.message
        : "Couldn't reach the server. Check your connection and try again.");
      setCode("");
      setBusy(false);
    }
  }

  const copy = known ? COPY[method] : null;

  return (
    <main className="lf-stage">
      <section className="lf-story" aria-label="Why we ask for a code">
        <h1 className="lf-headline">One more check.</h1>
        <p className="lf-sub">
          The code makes sure it's really you, even if someone else learns your password.
        </p>
      </section>

      {copy && !expired ? (
        <form className="lf-card lf-card-compact" onSubmit={submit} noValidate>
          <span className="lf-mail-mark" aria-hidden="true">
            {method === "email" ? (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5.5" width="18" height="13" rx="2" />
                <path d="M3.5 7l8.5 6 8.5-6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                   strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                <path d="M10.5 18.5h3" />
              </svg>
            )}
          </span>

          <h2 className="lf-card-title">{recovery ? "Use a recovery code" : copy.title}</h2>
          <p className="lf-sent">
            {recovery
              ? "Enter one of the recovery codes you saved when you set up your authenticator. Each code works once."
              : copy.sent}
          </p>

          <div className="lf-field">
            <label className="lf-label" htmlFor="lc-code">
              {recovery ? "Recovery code" : copy.label}
            </label>
            {recovery ? (
              <input
                key="recovery"
                ref={inputRef}
                id="lc-code"
                className="lf-input"
                style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", letterSpacing: "0.08em" }}
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={RECOVERY_LENGTH + 4 /* room for a pasted dash or spaces */}
                placeholder="xxxxxxxxxx-xxxxxxxxxx"
                value={code.length > RECOVERY_HALF ? `${code.slice(0, RECOVERY_HALF)}-${code.slice(RECOVERY_HALF)}` : code}                disabled={busy}
                onChange={(e) => handleChange(e.target.value)}
              />
            ) : (
              <input
                key="code"
                ref={inputRef}
                id="lc-code"
                className="lf-input lf-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH + 4 /* room for a pasted space or dash */}
                placeholder={"·".repeat(CODE_LENGTH)}
                value={code}
                disabled={busy}
                onChange={(e) => handleChange(e.target.value)}
              />
            )}
          </div>

          <div className="lf-error-slot" role="alert" aria-live="polite">
            {error ? (
              <div className="lf-error">{error}</div>
            ) : notice ? (
              <div className="lf-notice">{notice}</div>
            ) : null}
          </div>

          <button type="submit" className="lf-submit" disabled={busy || !ready}>
            {busy ? "Checking" : "Sign in"}
          </button>

          {method === "totp" ? (
            <div className="lf-resend">
              <span>{recovery ? "Have your phone?" : "Lost your phone?"}</span>{" "}
              <button type="button" className="lf-reveal" onClick={switchMode} disabled={busy}>
                {recovery ? "use an app code" : "use a recovery code"}
              </button>
            </div>
          ) : (
            <div className="lf-resend">
              <span>Didn't get it? Check spam, or</span>{" "}
              <button
                type="button"
                className="lf-reveal"
                onClick={resend}
                disabled={busy || resending || cooldown > 0}
              >
                {resending ? "sending" : cooldown > 0 ? `resend in ${cooldown}s` : "send a new code"}
              </button>
            </div>
          )}

          <p className="lf-foot">
            Not you?{" "}
            <Link className="lf-link" to="/">Back to sign in</Link>
          </p>
        </form>
      ) : (
        <div className="lf-card lf-card-compact">
          <h2 className="lf-card-title">{expired ? "Sign-in timed out" : "Nothing to confirm here"}</h2>
          <p className="lf-sent">
            {expired
              ? "That sign-in expired, so we cleared it. Enter your email and password again to get a new code."
              : "This page opens right after you enter your password. Go back and sign in."}
          </p>
          <Link className="lf-submit lf-submit-link" to="/">Go to sign in</Link>
        </div>
      )}
    </main>
  );
}