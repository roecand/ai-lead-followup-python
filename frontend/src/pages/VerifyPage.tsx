import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/client";
import { JoinSteps } from "../components/AuthChrome";

/**
 * Step after sign-up. The person types the 6-digit code we emailed them.
 *
 * How people get here
 *   - Sign-up succeeds:  navigate("/verify", { state: { email } })
 *   - Login finds an unverified account: same call, from LoginPage.
 * React Router keeps that state through a page refresh. Someone who opens
 * /verify directly has no email, so they're pointed back to sign in.
 *
 * Backend contract. Change the paths here if yours differ.
 *   POST VERIFY_PATH  { email, code }  -> 204 and sets the auth cookies
 *                                         400 wrong or expired code
 *                                         429 too many attempts
 *   POST RESEND_PATH  { email }        -> 204 (always, even for unknown emails)
 *                                         429 asked again too soon
 */
const VERIFY_PATH = "/auth/verify-email";
const RESEND_PATH = "/auth/resend-code";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 30;

export default function VerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email: string | undefined = (location.state as { email?: string } | null)?.email;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // A code was just sent when they arrived, so the cooldown starts right away.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);
  const [resending, setResending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Remembers the last code we auto-submitted, so a re-render can't send it twice.
  const submittedRef = useRef("");

  // Put the cursor back in the box whenever a check finishes. The input is
  // disabled while busy, so focusing it any earlier would do nothing.
  useEffect(() => {
    if (!busy) inputRef.current?.focus({ preventScroll: true });
  }, [busy]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function verify(value: string) {
    if (!email || busy) return;
    if (value.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from the email.`);
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}${VERIFY_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: value }),
      });

      if (response.ok) {
        navigate("/", { replace: true });
        return;
      }
      if (response.status === 429) {
        throw new Error("Too many tries. Request a new code and use that one.");
      }
      throw new Error("That code is wrong or has expired.");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch"
        ? err.message
        : "Couldn't reach the server. Check your connection and try again.");
      setCode("");
      submittedRef.current = "";
      setBusy(false);
    }
  }

  function handleChange(raw: string) {
    // Keep digits only, so pasting "123 456" or "123-456" still works.
    const digits = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submittedRef.current = code;
    verify(code);
  }

  async function resend() {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE}${RESEND_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response.status === 429) {
        setError("You asked for a code a moment ago. Give it a minute.");
      } else if (!response.ok) {
        setError("Couldn't send a new code. Try again.");
      } else {
        setNotice("A new code is on its way. Earlier codes no longer work.");
        setCode("");
        submittedRef.current = "";
        inputRef.current?.focus({ preventScroll: true });
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setResending(false);
      setCooldown(RESEND_COOLDOWN_S);
    }
  }

  return (
    <main className="lf-stage">
      <section className="lf-story" aria-label="How joining works">
        <h1 className="lf-headline">One last step.</h1>
        <p className="lf-sub">
          Your account is set up. Confirm your email and you'll go straight to your inbox.
        </p>
        <JoinSteps current={2} />
      </section>

      {email ? (
        <form className="lf-card lf-card-compact" onSubmit={handleSubmit} noValidate>
          <span className="lf-mail-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5.5" width="18" height="13" rx="2" />
              <path d="M3.5 7l8.5 6 8.5-6" />
            </svg>
          </span>

          <h2 className="lf-card-title">Check your email</h2>
          <p className="lf-sent">
            We sent a {CODE_LENGTH}-digit code to <strong>{email}</strong>. It expires in 5 minutes.
          </p>

          <div className="lf-field">
            <label className="lf-label" htmlFor="vf-code">Verification code</label>
            <input
              ref={inputRef}
              id="vf-code"
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
          </div>

          <div className="lf-error-slot" role="alert" aria-live="polite">
            {error ? (
              <div className="lf-error">{error}</div>
            ) : notice ? (
              <div className="lf-notice">{notice}</div>
            ) : null}
          </div>

          <button type="submit" className="lf-submit" disabled={busy || code.length !== CODE_LENGTH}>
            {busy ? "Checking" : "Verify and continue"}
          </button>

          <div className="lf-resend">
            <span>Didn't get it? Check spam, or</span>{" "}
            <button
              type="button"
              className="lf-reveal"
              onClick={resend}
              disabled={cooldown > 0 || resending}
            >
              {resending ? "sending" : cooldown > 0 ? `resend in ${cooldown}s` : "send a new code"}
            </button>
          </div>

          <p className="lf-foot">
            Wrong email?{" "}
            <Link className="lf-link" to="/signup">Start over</Link>
          </p>
        </form>
      ) : (
        <div className="lf-card lf-card-compact">
          <h2 className="lf-card-title">Nothing to verify here</h2>
          <p className="lf-sent">
            This page opens after you create an account or sign in. Sign in with your email and
            password, and we'll send you a new code if your email still needs confirming.
          </p>
          <Link className="lf-submit lf-submit-link" to="/">Go to sign in</Link>
        </div>
      )}
    </main>
  );
}
