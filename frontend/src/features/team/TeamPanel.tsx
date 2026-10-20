import { useEffect, useId, useState, type FormEvent } from "react";
import { copyText } from "../security/twoFactor";
import { ASSIGNABLE, fetchMe, looksLikeEmail, ROLE_INFO, sendInvite, TeamError, type Me, type Role, type SentInvite } from "./team";

/**
 * Settings > Team. Owners and admins can invite someone by email and pick
 * their role. The roles offered come from ASSIGNABLE, so an owner never sees
 * Admin. Staff see a short note instead of the form.
 */

export default function TeamPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="st-field tm">
      <style>{CSS}</style>
      <p className="st-field-label">Invite someone</p>

      {loadError ? (
        <>
          <p className="tm-msg is-error" role="alert">Couldn't load this. Check your connection and try again.</p>
          <button
            type="button"
            className="gs-btn"
            onClick={() => {
              setLoadError(false);
              setReloadKey((k) => k + 1);
            }}
          >
            Try again
          </button>
        </>
      ) : me === null ? (
        <p className="tm-text">Checking</p>
      ) : ASSIGNABLE[me.role].length === 0 ? (
        <p className="tm-text">Only an owner or admin can invite people. Ask yours to send the invite.</p>
      ) : (
        <InviteForm roles={ASSIGNABLE[me.role]} />
      )}
    </div>
  );
}

function InviteForm({ roles }: { roles: Role[] }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<SentInvite | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    const value = email.trim().toLowerCase();
    if (!looksLikeEmail(value)) return setError("Enter a full email address, like name@company.com.");
    if (!roles.includes(role)) return setError("Pick a role.");

    setBusy(true);
    setError("");
    try {
      setSent(await sendInvite(value, role));
    } catch (err) {
      if (!(err instanceof TeamError)) setError("Couldn't reach the server. Check your connection and try again.");
      else if (err.status === 401) return; // apiFetch is already sending them to sign in
      else if (err.status === 403) setError("You don't have permission to give that role.");
      else if (err.status === 409) setError("That email already has an account.");
      else if (err.status === 422) setError("That email or role wasn't accepted. Check it and try again.");
      else if (err.status === 429) setError("Too many invites at once. Wait a few minutes, then try again.");
      else setError(err.detail ?? "Couldn't send the invite. Try again.");
    }
    setBusy(false);
  }

  function startOver() {
    setSent(null);
    setEmail("");
    setRole("staff");
  }

  if (sent) return <SentNotice invite={sent} onAnother={startOver} />;

  return (
    <form className="tm-form" onSubmit={handleSubmit} noValidate>
      <label className="tm-label" htmlFor={emailId}>Their email</label>
      <input
        id={emailId}
        className="tm-input"
        type="email"
        autoComplete="off"
        spellCheck={false}
        placeholder="name@company.com"
        value={email}
        disabled={busy}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError("");
        }}
      />
      <p className="tm-hint">They have to sign up with this exact address.</p>

      <fieldset className="tm-roles" disabled={busy}>
        <legend className="tm-label">Role</legend>
        {roles.map((r) => (
          <label key={r} className={"tm-role" + (role === r ? " is-on" : "")}>
            <input
              type="radio"
              name="invite-role"
              value={r}
              checked={role === r}
              onChange={() => {
                setRole(r);
                if (error) setError("");
              }}
            />
            <span>
              <span className="tm-role-name">{ROLE_INFO[r].label}</span>
              <span className="tm-role-text">{ROLE_INFO[r].text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className={"tm-msg" + (error ? " is-error" : "")} role="alert" aria-live="polite">{error}</p>

      <button type="submit" className="gs-btn gs-btn-solid tm-submit" disabled={busy || !email.trim()}>
        {busy ? "Sending" : "Send invite"}
      </button>
    </form>
  );
}

function SentNotice({ invite, onAnother }: { invite: SentInvite; onAnother: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = invite.join_code
    ? `${window.location.origin}/signup?code=${encodeURIComponent(invite.join_code)}`
    : null;
  const expires = new Date(invite.expires_at).toLocaleDateString(undefined, { month: "long", day: "numeric" });

  async function handleCopy() {
    if (!link) return;
    setCopied(await copyText(link));
  }

  return (
    <div className="tm-sent" role="status">
      <p className="tm-sent-title">Invite sent to {invite.email}</p>
      <p className="tm-text">
        They'll join as {ROLE_INFO[invite.role].label.toLowerCase()}. The invite works until {expires}.
      </p>

      {link ? (
        <div className="tm-link">
          <p className="tm-hint">If the email doesn't show up, send them this link yourself.</p>
          <div className="tm-link-box">
            <code>{link}</code>
            <button type="button" className="gs-btn" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      ) : null}

      <button type="button" className="gs-btn tm-again" onClick={onAnother}>Invite someone else</button>
    </div>
  );
}

const CSS = `
.tm p { margin: 0; }
/* The section name sits above the form's own labels, so it reads as a small heading. */
.tm .st-field-label { margin-bottom: 14px; font-size: 14px; font-weight: 600; color: var(--ink); }
.tm-text { font-size: 14px; line-height: 1.5; color: var(--ink-soft); max-width: 52ch; }

.tm-form { max-width: 420px; }

.tm-label {
  display: block;
  margin: 0 0 6px; padding: 0;
  font-size: 13px; font-weight: 500;
  color: var(--ink-soft);
}

.tm-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  font-family: inherit; font-size: 14.5px;
  color: var(--ink);
  transition: border-color 130ms ease, box-shadow 130ms ease;
}
.tm-input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 3px var(--green-wash); }
.tm-input::placeholder { color: var(--ink-dim); }
.tm-input:disabled { opacity: 0.6; }

.tm-hint { margin-top: 6px !important; font-size: 12.5px; color: var(--ink-dim); }

.tm-roles { margin: 18px 0 0; padding: 0; border: none; min-width: 0; }
.tm-roles:disabled { opacity: 0.6; }
.tm-role {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 130ms ease, background 130ms ease;
}
.tm-role + .tm-role { margin-top: 8px; }
.tm-role:hover { border-color: var(--line-lit); }
.tm-role.is-on { border-color: var(--green); background: var(--green-wash); }
.tm-role input { margin: 3px 0 0; width: 15px; height: 15px; accent-color: var(--green); cursor: pointer; flex: none; }
.tm-role-name { display: block; font-size: 14px; font-weight: 500; color: var(--ink); }
.tm-role-text { display: block; margin-top: 2px; font-size: 13px; line-height: 1.45; color: var(--ink-soft); }

.tm-msg { min-height: 20px; margin: 10px 0 4px !important; font-size: 13.5px; line-height: 1.4; }
.tm-msg.is-error { color: #D64545; }

.tm-submit { padding: 8px 18px; font-size: 14px; }
.tm-submit:disabled { opacity: 0.5; cursor: default; }

.tm-sent { max-width: 460px; }
.tm-sent-title { margin-bottom: 4px !important; font-size: 15px; font-weight: 600; color: var(--green); }

.tm-link { margin-top: 14px; }
.tm-link-box {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  margin-top: 6px;
  padding: 8px 8px 8px 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.tm-link-box code {
  min-width: 0;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.tm-again { margin-top: 16px; }
`;
