import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  confirmTotp,
  copyText,
  groupKey,
  startTotp,
  TwoFactorError,
  type TotpStart,
} from "./twoFactor";

/**
 * Turns on an authenticator app, start to finish.
 *
 *   1. Asks the backend for a new key and shows it as a QR code (and as text
 *      for people who can't scan).
 *   2. The person types the code their app shows. If it matches, 2FA is on.
 *   3. Shows the recovery codes once, and waits until they say they saved them.
 *
 * Used by the sign-up flow and by Settings. Styles are in securityStyles.ts,
 * and the page around it must include SECURITY_CSS.
 */

interface TotpSetupProps {
  /** Runs after they confirm they saved the recovery codes. */
  onDone: () => void;
  doneLabel: string;
  /** Shown as a quiet link during the scan step. Leave out to hide it. */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Runs the moment 2FA is on, before the recovery codes step. */
  onEnabled?: () => void;
  /** Class for the step heading, so it can match the card it sits in. */
  titleClassName?: string;
}

type Phase =
  | { kind: "starting" }
  | { kind: "start-failed"; message: string; alreadyOn: boolean }
  | { kind: "scan"; setup: TotpStart }
  | { kind: "codes"; codes: string[] };

const CODE_LENGTH = 6;
const OFFLINE = "Couldn't reach the server. Check your connection and try again.";

export default function TotpSetup({
  onDone,
  doneLabel,
  onCancel,
  cancelLabel = "Cancel",
  onEnabled,
  titleClassName = "tf-title",
}: TotpSetupProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [notice, setNotice] = useState("");

  const begin = useCallback(async (reason?: string) => {
    setPhase({ kind: "starting" });
    try {
      const setup = await startTotp();
      setPhase({ kind: "scan", setup });
      setNotice(reason ?? "");
    } catch (err) {
      const alreadyOn = err instanceof TwoFactorError && err.status === 409;
      setPhase({
        kind: "start-failed",
        alreadyOn,
        message: alreadyOn
          ? "An authenticator app is already on for this account."
          : !(err instanceof TwoFactorError)
            ? OFFLINE
            : err.status === 401
              ? "Your session ended. Sign in again to finish this."
              : "Couldn't start setup. Try again.",
      });
    }
  }, []);

  // Start once. The ref keeps React's development double-run from asking the
  // backend for two different keys, which would leave the QR code and the
  // saved key out of step.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
  }, [begin]);

  // Move focus to each new step's heading so screen readers announce it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase.kind === "scan" || phase.kind === "codes") heading.current?.focus({ preventScroll: true });
  }, [phase.kind]);

  if (phase.kind === "codes") {
    return (
      <div className="tf">
        <h2 ref={heading} tabIndex={-1} className={titleClassName}>Save your recovery codes</h2>
        <RecoveryCodes codes={phase.codes} onDone={onDone} doneLabel={doneLabel} />
      </div>
    );
  }

  return (
    <div className="tf">
      <h2 ref={heading} tabIndex={-1} className={titleClassName}>Set up your authenticator app</h2>

      {phase.kind === "start-failed" ? (
        <>
          <p className="tf-msg is-error" role="alert">{phase.message}</p>
          <div className="tf-actions">
            {phase.alreadyOn ? (
              <button type="button" className="tf-primary" onClick={onDone}>{doneLabel}</button>
            ) : (
              <button type="button" className="tf-primary" onClick={() => void begin()}>Try again</button>
            )}
            {onCancel && !phase.alreadyOn ? (
              <button type="button" className="tf-quiet" onClick={onCancel}>{cancelLabel}</button>
            ) : null}
          </div>
        </>
      ) : (
        <ScanStep
          // A new key starts the step fresh, so "Copied" or an open key box from the old one doesn't carry over.
          key={phase.kind === "scan" ? phase.setup.secret : "waiting"}
          setup={phase.kind === "scan" ? phase.setup : null}
          notice={notice}
          onEnabled={(codes) => {
            onEnabled?.();
            setPhase({ kind: "codes", codes });
          }}
          onExpired={() => void begin("That setup timed out, so here's a new code. Scan this one instead.")}
          onCancel={onCancel}
          cancelLabel={cancelLabel}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   STEP 1 AND 2. Scan, then type the code.
--------------------------------------------------------------------------- */

function ScanStep({
  setup,
  notice,
  onEnabled,
  onExpired,
  onCancel,
  cancelLabel,
}: {
  /** Null while the backend is still making the key. */
  setup: TotpStart | null;
  notice: string;
  onEnabled: (codes: string[]) => void;
  onExpired: () => void;
  onCancel?: () => void;
  cancelLabel: string;
}) {
  const inputId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!setup || busy) return;
    if (code.length !== CODE_LENGTH) {
      setError(`Enter the ${CODE_LENGTH}-digit code from your app.`);
      return;
    }

    setBusy(true);
    setError("");
    try {
      onEnabled(await confirmTotp(code));
    } catch (err) {
      setCode("");
      setBusy(false);
      if (!(err instanceof TwoFactorError)) return setError(OFFLINE);
      if (err.status === 401) return; // apiFetch is already sending them to sign in
      if (err.status === 410) return onExpired();
      if (err.status === 429) return setError("Too many tries. Wait a few minutes, then try again.");
      setError("That code didn't match. Codes change every 30 seconds, so use the one showing now.");
    }
  }

  async function copyKey() {
    if (!setup) return;
    setCopied(await copyText(setup.secret));
  }

  return (
    <>
      <div className="tf-scan">
        <div className="tf-qr">
          {setup ? (
            <QRCodeSVG
              value={setup.otpauth_uri}
              size={132}
              level="M"
              marginSize={0}
              bgColor="#FFFFFF"
              fgColor="#111111"
              title="QR code to add Meridiem to your authenticator app"
            />
          ) : (
            <span className="tf-qr-wait">Making your code</span>
          )}
        </div>
        <ol className="tf-how">
          <li>Open <strong>Google Authenticator</strong> or any authenticator app.</li>
          <li>Add an account and scan this code.</li>
          <li>Type the {CODE_LENGTH}-digit code it shows below.</li>
        </ol>
      </div>

      <div className="tf-key">
        {showKey && setup ? (
          <>
            <div className="tf-key-box">
              <code aria-label="Setup key">{groupKey(setup.secret)}</code>
              <button type="button" className="tf-quiet" onClick={copyKey}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="tf-key-note">Pick "time based" if your app asks. Name it anything, like Meridiem.</p>
          </>
        ) : (
          <button type="button" className="tf-quiet" onClick={() => setShowKey(true)} disabled={!setup}>
            Can't scan it? Type a key instead
          </button>
        )}
      </div>

      <form className="tf-form" onSubmit={handleSubmit} noValidate>
        <label className="tf-label" htmlFor={inputId}>Code from your app</label>
        <input
          id={inputId}
          className="tf-input tf-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH + 4 /* room for a pasted space */}
          placeholder={"·".repeat(CODE_LENGTH)}
          value={code}
          disabled={busy || !setup}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
            if (error) setError("");
          }}
        />

        <p className={"tf-msg" + (error ? " is-error" : notice ? " is-ok" : "")} role="alert" aria-live="polite">
          {error || notice}
        </p>

        <div className="tf-actions">
          <button type="submit" className="tf-primary" disabled={busy || !setup || code.length !== CODE_LENGTH}>
            {busy ? "Checking" : "Turn on"}
          </button>
          {onCancel ? (
            <button type="button" className="tf-quiet" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          ) : null}
        </div>
      </form>
    </>
  );
}

/* ---------------------------------------------------------------------------
   STEP 3. Recovery codes. The backend only hands these out once.
--------------------------------------------------------------------------- */

function RecoveryCodes({ codes, onDone, doneLabel }: { codes: string[]; onDone: () => void; doneLabel: string }) {
  const [saved, setSaved] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const asText = codes.join("\n");

  async function copyAll() {
    setCopyState((await copyText(asText)) ? "copied" : "failed");
  }

  function download() {
    const body = [
      "Meridiem recovery codes",
      "Each code works once, if you can't use your authenticator app.",
      "",
      asText,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "meridiem-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <p className="tf-text">
        Your authenticator app is on. If you lose your phone, each of these codes lets you sign in once.
        Keep them somewhere safe, like a password manager. You won't see them again.
      </p>

      <ul className="tf-codes" aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}><code>{c}</code></li>
        ))}
      </ul>

      <div className="tf-code-tools">
        <button type="button" className="tf-quiet" onClick={copyAll}>
          {copyState === "copied" ? "Copied" : "Copy all"}
        </button>
        <button type="button" className="tf-quiet" onClick={download}>Download as a file</button>
      </div>
      {copyState === "failed" ? (
        <p className="tf-msg is-error" role="alert">Couldn't copy. Select the codes and copy them by hand.</p>
      ) : null}

      <label className="tf-check">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        I saved these codes
      </label>

      <div className="tf-actions">
        <button type="button" className="tf-primary" disabled={!saved} onClick={onDone}>{doneLabel}</button>
      </div>
    </>
  );
}
