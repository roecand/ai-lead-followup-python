import { useEffect, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE, refreshToken } from "../lib/client";

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

function useLasVegasTime() {
  const format = () =>
    new Date().toLocaleTimeString("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      minute: "2-digit",
    });
  const [time, setTime] = useState(format);

  useEffect(() => {
    const id = window.setInterval(() => setTime(format()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  return time;
}

export default function LoginPage({
  onSignIn,
  onGoogleSignIn,
}: {
  onSignIn?: (args: { email: string; password: string; remember: boolean }) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const clock = useLasVegasTime();

  // --- form state -----------------------------------------------------------
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // --- request state --------------------------------------------------------
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // --- sample thread --------------------------------------------------------
  const [shown, setShown] = useState(0);

  // If the browser still holds a valid refresh token, skip the form.
  useEffect(() => {
    refreshToken()
      .then((ok) => {
        if (ok) navigate("/dashboard", { replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  // Play the thread in once the form is visible.
  useEffect(() => {
    if (checking) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(THREAD.length);
      return;
    }

    const timers: number[] = [];
    let at = 0;
    STEP_MS.forEach((delay, i) => {
      at += delay;
      timers.push(window.setTimeout(() => setShown(i + 1), at));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [checking]);

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

  // Same color as the page so there's no white flash while the refresh check runs.
  if (checking) return <div style={{ minHeight: "100vh", background: "#14211A" }} />;

  const typing = shown < THREAD.length && THREAD[shown].from === "assistant";

  return (
    <div className="lf-root">
      <style>{CSS}</style>

      <div className="lf-dusk" aria-hidden="true" />
      <div className="lf-stars" aria-hidden="true" />
      <div className="lf-stars-far" aria-hidden="true" />
      <div className="lf-grain" aria-hidden="true" />

      <header className="lf-top">
        <div className="lf-brand">
          <svg className="lf-brand-mark" viewBox="0 0 24 24" width="22" height="22" focusable="false" aria-hidden="true">
            <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none">
              <path d="M5.5 16a6.5 6.5 0 0 1 13 0" />
              <line x1="2.5" y1="19.5" x2="21.5" y2="19.5" />
              <line x1="12" y1="4.5" x2="12" y2="6.5" />
              <line x1="4.8" y1="8.3" x2="6.2" y2="9.7" />
              <line x1="19.2" y1="8.3" x2="17.8" y2="9.7" />
            </g>
          </svg>
          <div className="lf-brand-text">
            <span className="lf-brand-name">Meridiem</span>
            <span className="lf-brand-parent">by Green Star</span>
          </div>
        </div>
        <span className="lf-locale">
          <span className="lf-locale-time">{clock}</span> in Las Vegas
        </span>
      </header>

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
    </div>
  );
}

/* ===========================================================================
   STYLES
   =========================================================================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&display=swap');

.lf-root {
  --field:      #14211A;  /* base, dark work green */
  --card:       rgba(23, 37, 30, 0.86);
  --surface:    #1B2B23;  /* inputs sit on this */
  --line:       #2E4238;  /* hairlines */
  --line-lit:   #4A6154;  /* hairlines on hover */
  --bone:       #E9E3D6;  /* primary text */
  --sage:       #94A79A;  /* secondary text */
  --sun:        #D9A441;  /* the single accent, low desert sun */
  --sun-lit:    #E8B75A;  /* accent on hover */
  --alert:      #E0714E;  /* errors */

  --radius:     6px;

  position: relative;
  min-height: 100vh;
  background: var(--field);
  color: var(--bone);
  font-family: 'Familjen Grotesk', system-ui, sans-serif;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

.lf-root *,
.lf-root *::before,
.lf-root *::after { box-sizing: border-box; }

.lf-root p { margin: 0; }

/* ---------- atmosphere ---------- */

/* Sun just under the horizon at the bottom, darker sky at the top. */
.lf-dusk {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(110% 55% at 50% 115%,
      rgba(217, 164, 65, 0.32) 0%,
      rgba(217, 164, 65, 0.11) 40%,
      rgba(217, 164, 65, 0) 70%),
    radial-gradient(90% 55% at 50% 0%,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0) 70%);
}

/* A few faint stars in the upper sky. Two layers twinkle out of step
   so the whole sky never pulses at once. */
.lf-stars {
  position: absolute;
  inset: 0 0 50% 0;
  pointer-events: none;
}

.lf-stars::before,
.lf-stars::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 2px;
  border-radius: 50%;
}

.lf-stars::before {
  box-shadow:
    8vw 9vh 0 rgba(233, 227, 214, 0.8),
    29vw 6vh 0 rgba(233, 227, 214, 0.7),
    55vw 8vh 0 rgba(233, 227, 214, 0.8),
    74vw 13vh 0 rgba(233, 227, 214, 0.7),
    93vw 7vh 0 rgba(233, 227, 214, 0.8),
    22vw 34vh 0 rgba(233, 227, 214, 0.5);
  animation: lf-twinkle 7s ease-in-out infinite;
}

.lf-stars::after {
  box-shadow:
    17vw 22vh 0 rgba(233, 227, 214, 0.5),
    41vw 17vh 0 rgba(233, 227, 214, 0.45),
    63vw 26vh 0 rgba(233, 227, 214, 0.5),
    86vw 21vh 0 rgba(233, 227, 214, 0.45),
    70vw 38vh 0 rgba(233, 227, 214, 0.4),
    4vw 30vh 0 rgba(233, 227, 214, 0.4);
  animation: lf-twinkle 9s ease-in-out -4s infinite;
}

/* A third, fainter layer of tiny distant stars. These don't twinkle, so
   the sky feels fuller without more movement. Densest near the top. */
.lf-stars-far {
  position: absolute;
  inset: 0 0 45% 0;
  pointer-events: none;
}

.lf-stars-far::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  border-radius: 50%;
  box-shadow:
    3vw 4vh 0 rgba(233, 227, 214, 0.5),
    12vw 15vh 0 rgba(233, 227, 214, 0.35),
    14vw 3vh 0 rgba(233, 227, 214, 0.45),
    24vw 11vh 0 rgba(233, 227, 214, 0.4),
    34vw 2vh 0 rgba(233, 227, 214, 0.5),
    37vw 13vh 0 rgba(233, 227, 214, 0.3),
    46vw 5vh 0 rgba(233, 227, 214, 0.45),
    50vw 21vh 0 rgba(233, 227, 214, 0.3),
    59vw 15vh 0 rgba(233, 227, 214, 0.4),
    66vw 3vh 0 rgba(233, 227, 214, 0.5),
    69vw 19vh 0 rgba(233, 227, 214, 0.3),
    79vw 6vh 0 rgba(233, 227, 214, 0.45),
    82vw 16vh 0 rgba(233, 227, 214, 0.35),
    89vw 12vh 0 rgba(233, 227, 214, 0.4),
    97vw 18vh 0 rgba(233, 227, 214, 0.35),
    6vw 24vh 0 rgba(233, 227, 214, 0.3),
    31vw 27vh 0 rgba(233, 227, 214, 0.25),
    57vw 30vh 0 rgba(233, 227, 214, 0.25),
    77vw 28vh 0 rgba(233, 227, 214, 0.3),
    95vw 33vh 0 rgba(233, 227, 214, 0.25),
    19vw 8vh 0 rgba(233, 227, 214, 0.4),
    43vw 9vh 0 rgba(233, 227, 214, 0.35),
    72vw 10vh 0 rgba(233, 227, 214, 0.4),
    91vw 2vh 0 rgba(233, 227, 214, 0.45);
}

@keyframes lf-twinkle {
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 0.8; }
}

/* Fine grain so the flat color reads like a photograph, not a swatch. */
.lf-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
}

/* ---------- header ---------- */

.lf-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 34px;
}

.lf-brand {
  display: flex;
  align-items: center;
  gap: 11px;
}

.lf-brand-mark { color: var(--sun); flex: none; }

.lf-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.lf-brand-name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.lf-brand-parent {
  margin-top: 4px;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--sage);
}

.lf-locale {
  font-size: 13px;
  color: var(--sage);
}

.lf-locale-time {
  color: var(--bone);
  font-variant-numeric: tabular-nums;
}

/* ---------- stage ---------- */

/* Card on the left, story on the right. The story comes first in the
   markup so phones still get the headline above the form, and order
   moves the card to the left once there are two columns. */
.lf-stage {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 430px) minmax(0, 520px);
  justify-content: center;
  align-items: center;
  column-gap: clamp(56px, 8vw, 130px);
  padding: 16px 32px 72px;
  min-height: calc(100vh - 86px);
}

.lf-card { order: -1; }

/* ---------- story column ---------- */

.lf-headline {
  font-size: clamp(36px, 3.6vw, 48px);
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.035em;
  margin: 0;
}

.lf-sub {
  margin-top: 14px !important;
  max-width: 40ch;
  font-size: 16px;
  line-height: 1.5;
  color: var(--sage);
}

.lf-phone {
  margin-top: 32px;
  max-width: 440px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(16, 27, 21, 0.6);
  overflow: hidden;
}

.lf-phone-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}

.lf-phone-avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--line-lit);
  font-size: 11px;
  font-weight: 600;
  color: var(--sage);
}

.lf-phone-who { display: flex; flex-direction: column; line-height: 1.2; }
.lf-phone-name { font-size: 14px; font-weight: 600; }
.lf-phone-meta { font-size: 12px; color: var(--sage); }

.lf-thread {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 16px 20px;
}

.lf-slot {
  position: relative;
  display: flex;
  max-width: 82%;
}

.lf-slot-lead      { align-self: flex-start; }
.lf-slot-assistant { align-self: flex-end; justify-content: flex-end; }

.lf-msg {
  display: flex;
  flex-direction: column;
  visibility: hidden;
}

.lf-slot-lead .lf-msg      { align-items: flex-start; }
.lf-slot-assistant .lf-msg { align-items: flex-end; }

.lf-msg.is-shown {
  visibility: visible;
  animation: lf-rise 360ms ease-out both;
}

.lf-bubble {
  padding: 9px 13px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.42;
}

.lf-slot-lead .lf-bubble {
  background: var(--surface);
  border: 1px solid var(--line);
  border-bottom-left-radius: 5px;
}

.lf-slot-assistant .lf-bubble {
  background: var(--sun);
  color: #14211A;
  border-bottom-right-radius: 5px;
}

.lf-msg-time {
  margin-top: 4px;
  padding: 0 4px;
  font-size: 11px;
  color: var(--sage);
  font-variant-numeric: tabular-nums;
}

/* Sits in the top corner of the slot its reply will fill. */
.lf-typing {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 4px;
  padding: 12px 14px;
  animation: lf-rise 240ms ease-out both;
}

.lf-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #14211A;
  opacity: 0.35;
  animation: lf-dot 1s ease-in-out infinite;
}
.lf-typing span:nth-child(2) { animation-delay: 0.15s; }
.lf-typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes lf-rise {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}

@keyframes lf-dot {
  0%, 100% { opacity: 0.3; transform: none; }
  50%      { opacity: 0.8; transform: translateY(-2px); }
}

/* ---------- card ---------- */

/* Solid, not glass. There is nothing busy behind it to blur. */
.lf-card {
  width: 100%;
  padding: 34px 32px 28px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.lf-card-title {
  margin: 0 0 22px;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* ---------- form ---------- */

.lf-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 11px 20px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 500;
  color: var(--bone);
  cursor: pointer;
  transition: border-color 130ms ease, background 130ms ease;
}

.lf-google:hover:not(:disabled) {
  border-color: var(--line-lit);
  background: rgba(255, 255, 255, 0.03);
}

.lf-google-mark {
  font-weight: 700;
  font-size: 15px;
  color: var(--sage);
}

.lf-or {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
  color: var(--sage);
  font-size: 13px;
}

.lf-or::before,
.lf-or::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--line);
}

.lf-field { margin-bottom: 16px; }

.lf-label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.lf-label {
  display: block;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--sage);
  margin-bottom: 7px;
}

.lf-reveal {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 13px;
  color: var(--sage);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lf-reveal:hover { color: var(--bone); }

.lf-input {
  width: 100%;
  padding: 11px 13px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 15.5px;
  color: var(--bone);
  transition: border-color 130ms ease, box-shadow 130ms ease;
}

.lf-input:focus {
  outline: none;
  border-color: var(--sun);
  box-shadow: 0 0 0 3px rgba(217, 164, 65, 0.15);
}

/* Stop Chrome autofill from repainting the inputs yellow or olive. */
.lf-input:-webkit-autofill,
.lf-input:-webkit-autofill:hover,
.lf-input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--bone);
  -webkit-box-shadow: 0 0 0 1000px var(--surface) inset;
  caret-color: var(--bone);
  transition: background-color 9999s ease-out;
}

.lf-input:-webkit-autofill:focus {
  -webkit-box-shadow:
    0 0 0 1000px var(--surface) inset,
    0 0 0 3px rgba(217, 164, 65, 0.15);
}

.lf-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-top: 4px;
}

.lf-remember {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 13.5px;
  color: var(--sage);
  cursor: pointer;
}

.lf-remember input {
  margin: 0;
  accent-color: var(--sun);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

/* Reserved space so the layout doesn't jump when an error appears. */
.lf-error-slot { min-height: 22px; margin: 14px 0 6px; }

.lf-error {
  color: var(--alert);
  font-size: 13.5px;
  line-height: 1.4;
}

.lf-submit {
  width: 100%;
  padding: 13px 16px;
  background: var(--sun);
  color: #14211A;
  border: none;
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 15.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 130ms ease;
}

.lf-submit:hover:not(:disabled) { background: var(--sun-lit); }

.lf-google:disabled,
.lf-submit:disabled { opacity: 0.5; cursor: default; }

.lf-foot {
  margin-top: 22px !important;
  text-align: center;
  font-size: 13.5px;
  color: var(--sage);
}

.lf-link {
  font-size: 13.5px;
  color: var(--sage);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.lf-link:hover { color: var(--bone); }

/* Keyboard focus stays visible everywhere. */
.lf-root :focus-visible {
  outline: 2px solid var(--sun);
  outline-offset: 2px;
}

/* ---------- responsive ---------- */

/* Below this width the thread would squeeze the form, so it steps aside
   and the headline moves above the card. */
@media (max-width: 980px) {
  .lf-stage {
    grid-template-columns: minmax(0, 400px);
    row-gap: 28px;
    align-content: center;
  }
  .lf-card { order: 0; }
  .lf-story { text-align: center; }
  .lf-sub { margin-left: auto; margin-right: auto; }
  .lf-phone { display: none; }
}

@media (max-width: 640px) {
  .lf-top { padding: 18px 20px; }
  .lf-locale { display: none; }
  .lf-stage { padding: 8px 16px 48px; align-content: start; row-gap: 22px; }
  .lf-headline { font-size: 30px; }
  .lf-sub { font-size: 14.5px; }
  .lf-card { padding: 26px 22px 22px; }
}

/* Big screens get bigger pieces, so the two panels fill the space
   instead of floating small in the middle. */
@media (min-width: 1600px) {
  .lf-top { padding: 28px 44px; }
  .lf-brand-name { font-size: 23px; }
  .lf-brand-parent { font-size: 12.5px; }
  .lf-locale { font-size: 14px; }

  .lf-stage {
    grid-template-columns: minmax(0, 500px) minmax(0, 620px);
    column-gap: 160px;
  }

  .lf-headline { font-size: 62px; }
  .lf-sub { font-size: 18.5px; margin-top: 18px !important; }

  .lf-phone { max-width: 520px; margin-top: 40px; border-radius: 22px; }
  .lf-phone-head { padding: 15px 20px; gap: 12px; }
  .lf-phone-avatar { width: 36px; height: 36px; font-size: 12.5px; }
  .lf-phone-name { font-size: 16px; }
  .lf-phone-meta { font-size: 13px; }
  .lf-thread { padding: 22px 20px 24px; gap: 14px; }
  .lf-bubble { padding: 11px 16px; font-size: 16px; border-radius: 18px; }
  .lf-msg-time { font-size: 12px; }

  .lf-card { padding: 44px 42px 36px; border-radius: 18px; }
  .lf-card-title { font-size: 28px; margin-bottom: 28px; }
  .lf-google { padding: 14px 22px; font-size: 16.5px; }
  .lf-or { margin: 24px 0; font-size: 14px; }
  .lf-field { margin-bottom: 20px; }
  .lf-label { font-size: 15px; margin-bottom: 8px; }
  .lf-reveal { font-size: 14px; }
  .lf-input { padding: 14px 16px; font-size: 17px; }
  .lf-remember, .lf-link, .lf-foot { font-size: 14.5px; }
  .lf-remember input { width: 17px; height: 17px; }
  .lf-submit { padding: 16px; font-size: 17px; }
  .lf-foot { margin-top: 26px !important; }
}

@media (prefers-reduced-motion: reduce) {
  .lf-root * { transition: none !important; }
  .lf-msg.is-shown,
  .lf-typing,
  .lf-typing span,
  .lf-stars::before,
  .lf-stars::after { animation: none; }
}
`;