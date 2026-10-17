import { useEffect, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../../../shared/api/client";
import { LOGIN_CODE_PATH } from "../authPaths";

/* ---------------------------------------------------------------------------
   Sample thread shown beside the form. It uses the fictional demo business
   from business.example.json, and follows its policies (the $89 diagnostic,
   no arrival time until dispatch confirms).
--------------------------------------------------------------------------- */
type Msg = { from: "lead" | "assistant"; text: string; time: string };

const THREAD: Msg[] = [
  {
    from: "lead",
    time: "11:47 PM",
    text: "Our AC stopped blowing cold and it's 91 in here. Can someone come out tomorrow?",
  },
  {
    from: "assistant",
    time: "11:47 PM",
    text: "Sorry about that. We can send a tech tomorrow. The visit is $89 and goes toward the repair. Morning or afternoon?",
  },
  { from: "lead", time: "11:48 PM", text: "Morning please" },
  {
    from: "assistant",
    time: "11:48 PM",
    text: "You're on tomorrow's morning list. Dispatch will text you first thing to confirm the arrival window.",
  },
];

// Delay before each message appears, in ms. Assistant replies get a short
// "typing" beat first so the thread feels live without being slow.
const STEP_MS = [500, 1900, 1500, 1900];

export default function LoginPage({
  onSignIn,
  onGoogleSignIn,
}: {
  onSignIn?: (args: { email: string; password: string; remember: boolean }) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
}) {
  const navigate = useNavigate();

  // --- form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // --- request state
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // --- sample thread
  // With reduced motion the whole thread shows at once, no playback.
  const [shown, setShown] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? THREAD.length : 0,
  );

  // The "already signed in?" check lives in AuthShell now, so it runs once
  // for login, sign-up and verify together.

  // Play the thread in once the page is on screen.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timers: number[] = [];
    let at = 0;
    STEP_MS.forEach((delay, i) => {
      at += delay;
      timers.push(window.setTimeout(() => setShown(i + 1), at));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  async function handleSubmit() {
    setError("");

    if (!email.trim() || !password) {
      setError("Enter your email and password to sign in.");
      return;
    }

    setBusy(true);
    try {
      if (onSignIn) {
        await onSignIn({ email: email.trim(), password, remember });
      } else {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, remember }),
        });

        if (response.status === 429) {
          throw new Error("Too many sign-in attempts. Try again in a few minutes.");
        }
        if (!response.ok) {
          throw new Error("That email and password don't match an account.");
        }

        // The password was right. The backend set the login challenge as a
        // cookie and tells us which kind of code to ask for.
        const data = await response.json().catch(() => null);
        if (data?.method) {
          navigate(LOGIN_CODE_PATH, { state: { method: data.method } });
          return;
        }
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in didn't complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      if (onGoogleSignIn) {
        await onGoogleSignIn();
      } else {
        throw new Error("Google sign-in is not connected to a backend yet.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in didn't complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Submit on Enter from either field.
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !busy) handleSubmit();
  }

  const typing = shown < THREAD.length && THREAD[shown].from === "assistant";

  return (
    <main className="lf-stage">
      <section className="lf-story" aria-label="Example conversation">
        <h1 className="lf-headline">No lead waits for morning.</h1>
        <p className="lf-sub">
          Meridiem answers every text the moment it lands, books the job, and hands the
          rest to your team.
        </p>

        <div className="lf-phone" aria-hidden="true">
          <div className="lf-phone-head">
            <span className="lf-phone-avatar">SC</span>
            <span className="lf-phone-who">
              <span className="lf-phone-name">Summit Climate</span>
              <span className="lf-phone-meta">Example conversation</span>
            </span>
          </div>

          {/* Every message is always laid out, just hidden until its turn,
              so the box is exactly as tall as the full thread and nothing
              shifts while it plays. */}
          <div className="lf-thread">
            {THREAD.map((m, i) => (
              <div key={i} className={"lf-slot lf-slot-" + m.from}>
                <div className={"lf-msg" + (i < shown ? " is-shown" : "")}>
                  <p className="lf-bubble">{m.text}</p>
                  <span className="lf-msg-time">
                    {m.from === "assistant" ? "Meridiem · " : ""}
                    {m.time}
                  </span>
                </div>

                {typing && i === shown ? (
                  <p className="lf-bubble lf-typing">
                    <span />
                    <span />
                    <span />
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lf-card">
        <h2 className="lf-card-title">Sign in</h2>

        <button type="button" className="lf-google" onClick={handleGoogle} disabled={busy}>
          {/* Swap this for Google's official mark before shipping.
              Their branding guidelines require the real asset. */}
          <span className="lf-google-mark">G</span>
          Continue with Google
        </button>

        <div className="lf-or">
          <span>or</span>
        </div>

        <div className="lf-field">
          <label className="lf-label" htmlFor="lf-email">
            Email
          </label>
          <input
            id="lf-email"
            className="lf-input"
            type="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="lf-field">
          <div className="lf-label-row">
            <label className="lf-label" htmlFor="lf-password">
              Password
            </label>
            <button type="button" className="lf-reveal" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="lf-password"
            className="lf-input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="lf-options">
          <label className="lf-remember">
            <input
              type="checkbox"
              checked={remember}
              disabled={busy}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember for 30 days</span>
          </label>

          <Link className="lf-link" to="/reset-password">
            Forgot your password?
          </Link>
        </div>

        {/* aria-live means a screen reader announces the error when it
            appears, instead of the user submitting into silence. */}
        <div className="lf-error-slot" role="alert" aria-live="polite">
          {error ? <div className="lf-error">{error}</div> : null}
        </div>

        <button type="button" className="lf-submit" onClick={handleSubmit} disabled={busy}>
          {busy ? "Signing in" : "Sign in"}
        </button>

        <p className="lf-foot">
          Don't have an account?{" "}
          <Link className="lf-link" to="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}