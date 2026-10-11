import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE, refreshToken } from "../lib/client";
import { AUTH_CSS } from "../lib/authStyles";
import { AuthBackdrop, AuthBlank, AuthTop } from "../components/AuthChrome";

/**
 * Sign-up for team members joining a company that already exists.
 * The company owner shares a join code (Settings > Team). An invite link
 * like /signup?code=AbC123xy fills the code in for them.
 *
 * Posts to /auth/signup, which creates the user and signs them in by
 * setting the same cookies as /auth/login.
 */

// Keep these in step with SignupRequest in backend/schemas.py.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt only reads the first 72 bytes

const STEPS = [
  {
    title: "Get your join code",
    text: "Whoever set up Meridiem for your company can find it under Settings, then Team.",
  },
  {
    title: "Create your account",
    text: "Use the email you check at work. That's where handoff alerts will go.",
  },
  {
    title: "Pick up where the assistant stops",
    text: "Conversations that need a person show up in your inbox, marked in amber.",
  },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // --- form state -----------------------------------------------------------
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [joinCode, setJoinCode] = useState(() => params.get("code")?.trim() ?? "");
  const [showPassword, setShowPassword] = useState(false);

  // --- request state --------------------------------------------------------
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in? Then there's nothing to sign up for.
  useEffect(() => {
    refreshToken()
      .then((ok) => {
        if (ok) navigate("/dashboard", { replace: true });
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [navigate]);

  const passwordShort = password.length > 0 && password.length < PASSWORD_MIN;

  // Only flag a mismatch once they've typed something in the confirm box,
  // so the page doesn't scold them before they've gotten there.
  const emailMismatch =
    confirmEmail.length > 0 && confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase();
  const passwordMismatch = confirmPassword.length > 0 && confirmPassword !== password;

  function validate(): string {
    if (!name.trim()) return "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Enter a valid email address.";
    if (confirmEmail.trim().toLowerCase() !== email.trim().toLowerCase()) return "The two email addresses don't match.";
    if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters for your password.`;
    if (new TextEncoder().encode(password).length > PASSWORD_MAX) return "That password is too long. Keep it under 72 characters.";
    if (confirmPassword !== password) return "The two passwords don't match.";
    if (!joinCode.trim()) return "Enter the join code from your company.";
    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const problem = validate();
    setError(problem);
    if (problem) return;

    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          join_code: joinCode.trim(),
        }),
      });

      if (!response.ok) throw new Error(await signupError(response));
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up didn't complete. Try again.");
      setBusy(false);
    }
  }

  if (checking) return <AuthBlank />;

  return (
    <div className="lf-root">
      <style>{AUTH_CSS}</style>

      <AuthBackdrop />
      <AuthTop />

      <main className="lf-stage">
        <section className="lf-story" aria-label="How joining works">
          <h1 className="lf-headline">Join your team on Meridiem.</h1>
          <p className="lf-sub">
            Your company is already set up. Add yourself with the join code and you'll see
            every conversation the moment you're in.
          </p>

          <ol className="lf-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="lf-step">
                <span className="lf-step-num" aria-hidden="true">{i + 1}</span>
                <span className="lf-step-body">
                  <span className="lf-step-title">{s.title}</span>
                  <span className="lf-step-text">{s.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <form className="lf-card lf-card-compact" onSubmit={handleSubmit} noValidate>
          <h2 className="lf-card-title">Create your account</h2>

          <div className="lf-field">
            <label className="lf-label" htmlFor="su-name">Full name</label>
            <input
              id="su-name"
              className="lf-input"
              type="text"
              autoComplete="name"
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="lf-field">
            <label className="lf-label" htmlFor="su-email">Work email</label>
            <input
              id="su-email"
              className="lf-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="lf-field">
            <label className="lf-label" htmlFor="su-email2">Confirm email</label>
            <input
              id="su-email2"
              className="lf-input"
              type="email"
              autoComplete="off"
              inputMode="email"
              aria-invalid={emailMismatch}
              aria-describedby={emailMismatch ? "su-email2-hint" : undefined}
              value={confirmEmail}
              disabled={busy}
              onChange={(e) => setConfirmEmail(e.target.value)}
            />
            {emailMismatch ? (
              <p id="su-email2-hint" className="lf-hint is-warn">Doesn't match yet</p>
            ) : null}
          </div>

          <div className="lf-field">
            <div className="lf-pair">
              <div>
                <div className="lf-label-row">
                  <label className="lf-label" htmlFor="su-password">Password</label>
                  <button type="button" className="lf-reveal" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  id="su-password"
                  className="lf-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-describedby="su-password-hint"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <div className="lf-label-row">
                  <label className="lf-label" htmlFor="su-password2">Confirm</label>
                </div>
                <input
                  id="su-password2"
                  className="lf-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  aria-invalid={passwordMismatch}
                  aria-describedby="su-password-hint"
                  value={confirmPassword}
                  disabled={busy}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {/* One hint line for both boxes. It shows the most useful thing right now. */}
            <p id="su-password-hint" className={"lf-hint" + (passwordShort || passwordMismatch ? " is-warn" : "")}>
              {passwordMismatch
                ? "The passwords don't match yet"
                : passwordShort
                  ? `At least ${PASSWORD_MIN} characters, ${PASSWORD_MIN - password.length} to go`
                  : `At least ${PASSWORD_MIN} characters`}
            </p>
          </div>

          <div className="lf-field">
            <label className="lf-label" htmlFor="su-code">Company join code</label>
            <input
              id="su-code"
              className="lf-input lf-input-code"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="su-code-hint"
              value={joinCode}
              disabled={busy}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <p id="su-code-hint" className="lf-hint">
              Ask whoever manages Meridiem at your company.
            </p>
          </div>

          <div className="lf-error-slot" role="alert" aria-live="polite">
            {error ? <div className="lf-error">{error}</div> : null}
          </div>

          <button type="submit" className="lf-submit" disabled={busy}>
            {busy ? "Creating account" : "Create account"}
          </button>

          <p className="lf-foot">
            Already have an account?{" "}
            <Link className="lf-link" to="/">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}

/** Turns the backend's answer into something a person can act on. */
async function signupError(response: Response): Promise<string> {
  if (response.status === 429) return "Too many sign-up attempts. Try again in a few minutes.";

  let detail = "";
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") detail = body.detail;
  } catch {
    /* not JSON, fall through to the generic messages */
  }

  if (response.status === 409) return detail || "An account with that email already exists. Try signing in.";
  if (response.status === 400 || response.status === 404) {
    return detail || "That join code didn't match a company. Check it with your company's admin.";
  }
  if (response.status === 422) return "Some of those details aren't valid. Check each field and try again.";
  return "Sign-up didn't complete. Try again.";
}