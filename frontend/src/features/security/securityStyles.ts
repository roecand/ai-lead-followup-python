/**
 * Styles for the two-step sign-in pieces. They show up in two places that
 * look different, the sign-up flow (dusk sky, sun accent) and Settings (app
 * themes, green accent). Everything below reads --tf-* colors, and the two
 * blocks at the top point those at whichever palette is around them.
 */
export const SECURITY_CSS = `
.lf-root .tf {
  --tf-ink: var(--bone);
  --tf-soft: var(--sage);
  --tf-line: var(--line);
  --tf-line-lit: var(--line-lit);
  --tf-field: var(--surface);
  --tf-accent: var(--sun);
  --tf-accent-lit: var(--sun-lit);
  --tf-on-accent: #14211A;
  --tf-wash: rgba(217, 164, 65, 0.1);
  --tf-ring: rgba(217, 164, 65, 0.15);
  --tf-alert: var(--alert);
  --tf-radius: 6px;
}
.gs-page .tf {
  --tf-ink: var(--ink);
  --tf-soft: var(--ink-soft);
  --tf-line: var(--line);
  --tf-line-lit: var(--line-lit);
  --tf-field: var(--paper);
  --tf-accent: var(--green);
  --tf-accent-lit: var(--green-lit);
  --tf-on-accent: var(--on-green);
  --tf-wash: var(--green-wash);
  --tf-ring: var(--green-wash);
  --tf-alert: var(--alert);
  --tf-radius: var(--radius);
}

.tf { color: var(--tf-ink); }
.tf p { margin: 0; }
.tf-title { margin: 0 0 8px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.tf-title:focus { outline: none; }
.tf-text { font-size: 14px; line-height: 1.5; color: var(--tf-soft); max-width: 52ch; }

/* ---------- scan ---------- */

.tf-scan {
  display: flex; align-items: center; gap: 18px;
  margin-top: 4px;
}

/* QR codes need dark on light to scan reliably, so the tile stays white in every theme. */
.tf-qr {
  flex: none;
  display: grid; place-items: center;
  padding: 10px;
  background: #FFFFFF;
  border-radius: 10px;
  box-shadow: 0 0 0 1px var(--tf-line);
}
.tf-qr svg { display: block; }
.tf-qr-wait {
  width: 132px; height: 132px;
  display: grid; place-items: center;
  font-size: 12.5px; color: #6B7A71;
}

.tf-how {
  margin: 0; padding-left: 18px;
  font-size: 13.5px; line-height: 1.45; color: var(--tf-soft);
}
.tf-how li + li { margin-top: 6px; }
.tf-how strong { color: var(--tf-ink); font-weight: 600; }

.tf-key { margin-top: 14px; }
.tf-key-box {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 9px 12px;
  background: var(--tf-field);
  border: 1px solid var(--tf-line);
  border-radius: var(--tf-radius);
}
.tf-key-box code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14px; letter-spacing: 0.04em;
  color: var(--tf-ink);
  word-break: break-all;
}
.tf-key-note { margin-top: 6px !important; font-size: 12.5px; color: var(--tf-soft); }

/* ---------- form bits ---------- */

.tf-form { margin-top: 16px; }

.tf-label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px; font-weight: 500;
  color: var(--tf-soft);
}

.tf-input {
  width: 100%;
  padding: 9px 12px;
  background: var(--tf-field);
  border: 1px solid var(--tf-line);
  border-radius: var(--tf-radius);
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 15px;
  color: var(--tf-ink);
  transition: border-color 130ms ease, box-shadow 130ms ease;
}
.tf-input:focus { outline: none; border-color: var(--tf-accent); box-shadow: 0 0 0 3px var(--tf-ring); }
.tf-input::placeholder { color: var(--tf-line-lit); }
.tf-input:disabled { opacity: 0.6; }

/* Same one-box code entry as the verify page. */
.tf-code {
  padding: 10px 14px;
  text-align: center;
  font-size: 24px; font-weight: 600;
  letter-spacing: 0.5em;
  text-indent: 0.5em;
}
.gs-page .tf-code { max-width: 260px; }

.tf-msg { min-height: 20px; margin: 8px 0 4px !important; font-size: 13.5px; line-height: 1.4; }
.tf-msg.is-error { color: var(--tf-alert); }
.tf-msg.is-ok { color: var(--tf-accent); }

.tf-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; }

.tf-primary {
  padding: 9px 18px;
  background: var(--tf-accent);
  color: var(--tf-on-accent);
  border: none;
  border-radius: var(--tf-radius);
  font-family: inherit; font-size: 14px; font-weight: 600;
  cursor: pointer;
  transition: background 130ms ease;
}
.tf-primary:hover:not(:disabled) { background: var(--tf-accent-lit); }
.tf-primary:disabled { opacity: 0.5; cursor: default; }

.tf-quiet {
  padding: 0;
  background: none; border: none;
  font-family: inherit; font-size: 13px;
  color: var(--tf-soft);
  text-decoration: underline; text-underline-offset: 3px;
  cursor: pointer;
}
.tf-quiet:hover { color: var(--tf-ink); }

/* In the sign-up card the main button spans the card, like the other auth pages. */
.lf-root .tf-actions { flex-direction: column; align-items: stretch; gap: 14px; }
.lf-root .tf-primary { width: 100%; padding: 12px 16px; font-size: 15.5px; }
.lf-root .tf-actions .tf-quiet { align-self: center; }
/* In Settings it matches the app's rounded buttons. */
.gs-page .tf-primary { border-radius: 999px; font-weight: 500; }

/* ---------- recovery codes ---------- */

.tf-codes {
  list-style: none;
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px;
  margin: 14px 0 0; padding: 12px 14px;
  background: var(--tf-field);
  border: 1px solid var(--tf-line);
  border-radius: var(--tf-radius);
}
.gs-page .tf-codes { max-width: 360px; }
.tf-codes code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 14.5px; letter-spacing: 0.05em;
  color: var(--tf-ink);
}

.tf-code-tools { display: flex; gap: 16px; margin-top: 10px; }

.tf-check {
  display: flex; align-items: center; gap: 9px;
  margin-top: 16px;
  font-size: 13.5px; color: var(--tf-soft);
  cursor: pointer;
}
.tf-check input { margin: 0; width: 15px; height: 15px; accent-color: var(--tf-accent); cursor: pointer; }

/* ---------- Settings status ---------- */

.tf-status { display: flex; align-items: flex-start; gap: 12px; margin: 4px 0 14px; }
.tf-status + .tf-form { margin-top: 0; }
.tf-status + .tf-msg { margin-top: -6px !important; }
/* Under the "Two-step sign-in" label in Settings the step heading needs room. */
.gs-page .tf .tf-title { margin: 12px 0 14px; }
.tf-badge {
  flex: none;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--tf-line-lit);
  font-size: 12.5px; font-weight: 500;
  color: var(--tf-soft);
}
.tf-badge.is-on { background: var(--tf-wash); border-color: transparent; color: var(--tf-accent); }

.tf-danger {
  padding: 8px 16px;
  background: none;
  border: 1px solid var(--tf-alert);
  border-radius: 999px;
  font-family: inherit; font-size: 13.5px; font-weight: 500;
  color: var(--tf-alert);
  cursor: pointer;
}
.tf-danger:hover:not(:disabled) { background: color-mix(in srgb, var(--tf-alert) 12%, transparent); }
.tf-danger:disabled { opacity: 0.5; cursor: default; }

.gs-page .tf-disable { max-width: 360px; }

@media (max-width: 420px) {
  .tf-scan { flex-direction: column; align-items: flex-start; }
}

@media (min-width: 1600px) {
  .lf-root .tf-how { font-size: 14.5px; }
  .lf-root .tf-code { font-size: 28px; }
}
`;
