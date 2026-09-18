import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";

export default function LoginPage({
  onSignIn,
  onGoogleSignIn,
}: {
  onSignIn?: (args: { email: string; password: string; remember: boolean }) => Promise<void>;
  onGoogleSignIn?: () => Promise<void>;
}) {
    const navigate = useNavigate();
  // --- form state -----------------------------------------------------------
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // --- request state --------------------------------------------------------
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

          if (!response.ok){
            throw new Error("Sign-in failed");
          }

      }
      navigate("/messageboard");
    }
    catch (err) {
      setError(
        err?.message === "Sign-in is not connected to a backend yet."
          ? err.message
          : "That email and password don't match an account."
      );
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
        // ===================== BACKEND HOOK =========================
        // Google sign-in. This one navigates away to Google and comes back,
        // so there is usually nothing to await and no success state to render.
        //
        //   const { error } = await supabase.auth.signInWithOAuth({
        //     provider: "google",
        //     options: { redirectTo: window.location.origin + "/leads" },
        //   });
        //   if (error) throw error;
        // ===============================================================
        throw new Error("Google sign-in is not connected to a backend yet.");
      }
    } catch (err) {
      setError(err?.message || "Google sign-in didn't complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Submit on Enter from either field.
  function handleKeyDown(e) {
    if (e.key === "Enter" && !busy) handleSubmit();
  }

  return (
    <div className="lf-root">
      <style>{CSS}</style>

      <div className="lf-dusk" aria-hidden="true" />
      <div className="lf-grain" aria-hidden="true" />

      <header className="lf-top">
        <span className="lf-mark">
          <svg viewBox="0 0 24 24" width="20" height="20" focusable="false">
            <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke">
              <line x1="12" y1="2.5" x2="12" y2="21.5" />
              <line x1="3.77" y1="7.25" x2="20.23" y2="16.75" />
              <line x1="3.77" y1="16.75" x2="20.23" y2="7.25" />
            </g>
          </svg>
            <span> Green Star </span>
        </span>
        <span className="lf-locale">Las Vegas</span>
      </header>

      <main className="lf-stage">
        <div className="lf-column">
          <h1 className="lf-headline">No lead waits for morning.</h1>

          <div className="lf-form">
            <div className="lf-field">
              <button
                type="button"
                className="lf-google"
                onClick={handleGoogle}
                disabled={busy}
              >
              {/* Swap this for Google's official mark before shipping.
                  Their branding guidelines require the real asset. */}
              <span className="lf-google-mark">G</span>
                Continue with Google
              </button>

              <div className="lf-or">
                <span>or</span>
              </div>
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
                <button
                  type="button"
                  className="lf-reveal"
                  onClick={() => setShowPassword((v) => !v)}
                >
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

            <label className="lf-remember">
              <input
                type="checkbox"
                checked={remember}
                disabled={busy}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Stay signed in on this device for 30 days</span>
            </label>

            {/* aria-live means a screen reader announces the error when it
                appears, instead of the user submitting into silence. */}
            <div className="lf-error-slot" role="alert" aria-live="polite">
              {error ? <div className="lf-error">{error}</div> : null}
            </div>

            <button
              type="button"
              className="lf-submit"
              onClick={handleSubmit}
              disabled={busy}
            >
              {busy ? "Signing in" : "Sign in"}
            </button>

            <div className="lf-foot">
              <a className="lf-link" href="/reset-password">
                Forgot your password?
              </a>
            </div>
          </div>
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
  --surface:    #1B2B23;  /* inputs sit on this */
  --line:       #2E4238;  /* hairlines */
  --line-lit:   #4A6154;  /* hairlines on hover */
  --bone:       #E9E3D6;  /* primary text */
  --sage:       #94A79A;  /* secondary text */
  --sun:        #D9A441;  /* the single accent, low desert sun */
  --sun-lit:    #E8B75A;  /* accent on hover */
  --alert:      #E0714E;  /* errors */

  --radius:     4px;

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

/* ---------- atmosphere ---------- */

/* Low sun sitting just under the horizon, bottom of frame. */
.lf-dusk {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 62% at 50% 118%,
      rgba(217, 164, 65, 0.30) 0%,
      rgba(217, 164, 65, 0.10) 38%,
      rgba(217, 164, 65, 0) 68%),
    radial-gradient(90% 55% at 50% 0%,
      rgba(0, 0, 0, 0.45) 0%,
      rgba(0, 0, 0, 0) 70%);
}

/* Fine grain so the flat color reads like a photograph, not a swatch. */
.lf-grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E");
}

/* ---------- chrome ---------- */

.lf-top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 26px 34px;
}

.lf-mark {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 10px;
}

.lf-mark span {
  position: relative;
  top: -1px
}

.lf-locale {
  font-size: 13px;
  color: var(--sage);
}

/* ---------- stage ---------- */

.lf-stage {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 24px 72px;
  min-height: calc(100vh - 74px);
}

.lf-column { width: 100%; max-width: 372px; }

/* The one loud thing on the page. */
.lf-headline {
  font-size: clamp(34px, 6vw, 46px);
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.035em;
  margin: 0 0 40px;
  text-align: center; 
}

/* ---------- form ---------- */

.lf-google {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 20px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;   /* pill */
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

.lf-field { margin-bottom: 18px; }

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

.lf-remember {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  color: var(--sage);
  cursor: pointer;
  margin-top: 4px;
}

.lf-remember input {
  margin: 2px 0 0;
  accent-color: var(--sun);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

/* Reserved space so the layout doesn't jump when an error appears. */
.lf-error-slot { min-height: 22px; margin: 16px 0 4px; }

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

.lf-foot { margin-top: 26px; }

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

@media (max-width: 640px) {
  .lf-top { padding: 20px 22px; }
  .lf-stage { align-items: flex-start; padding-top: 20px; }
  .lf-headline { margin-bottom: 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .lf-root * { transition: none !important; }
}
`;