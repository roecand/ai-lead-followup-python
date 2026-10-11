/**
 * Shared chrome for the dashboard, inbox and settings pages: header, page
 * frame, cards, buttons. Colors come from the tokens in src/index.css, so
 * light and dark both work without anything in here changing.
 */
export const THEME_CSS = `
.gs-page {
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font);
  font-size: 16px;
  line-height: 1.45;
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
}

.gs-page *,
.gs-page *::before,
.gs-page *::after { box-sizing: border-box; }

.gs-page button { font-family: inherit; }
.gs-page h1, .gs-page h2, .gs-page h3 { color: var(--ink); font-family: inherit; }
.gs-page p { margin: 0; }
.gs-page a { color: inherit; text-decoration: none; }
/* Classes below that also land on <a> tags are written as .gs-page .x so they
   win over the plain link reset above. */

.gs-page :focus-visible {
  outline: 2px solid var(--green);
  outline-offset: 2px;
}

/* ---------- app header ---------- */

.gs-top {
  position: sticky; top: 0; z-index: 10;
  height: var(--top-h);
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px;
  padding: 0 20px;
  background: var(--card);
  border-bottom: 1px solid var(--line);
  font-family: var(--font);
  color: var(--ink);
}
.gs-top a { color: inherit; text-decoration: none; }

.gs-top-left { display: flex; align-items: center; gap: 28px; min-width: 0; }

.gs-mark {
  display: flex; align-items: center; gap: 8px;
  font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
}
.gs-mark svg { color: var(--green); flex-shrink: 0; position: relative; top: -1px; }

.gs-nav { display: flex; align-items: center; gap: 4px; }
.gs-nav-link {
  padding: 6px 12px;
  border-radius: 999px;
  color: var(--ink-soft);
  font-size: 14px;
  transition: color 120ms ease, background 120ms ease;
}
.gs-nav-link:hover { color: var(--ink); }
.gs-nav-link.is-on { color: var(--green); background: var(--green-wash); font-weight: 500; }

.gs-top-right { display: flex; align-items: center; gap: 10px; }

.gs-waiting {
  display: inline-flex; align-items: center; gap: 8px;
  margin-right: 6px;
  font-size: 13px; font-weight: 500; color: var(--flag);
}
.gs-waiting-clear { color: var(--ink-dim); font-weight: 400; }
.gs-dot-sun { width: 6px; height: 6px; border-radius: 50%; background: var(--flag); }

/* Live / Offline. Green pulse when the websocket is up. */
.gs-live {
  display: inline-flex; align-items: center; gap: 7px;
  margin-right: 4px;
  font-size: 12.5px; color: var(--ink-dim);
}
.gs-live-dot {
  position: relative;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--ink-dim); opacity: 0.6;
}
.gs-live.is-live { color: var(--ink-soft); }
.gs-live.is-live .gs-live-dot { background: var(--green); opacity: 1; }
.gs-live.is-live .gs-live-dot::after {
  content: "";
  position: absolute; inset: 0; border-radius: 50%;
  background: var(--green);
  animation: gs-pulse 2.4s ease-out infinite;
}
@keyframes gs-pulse {
  0% { transform: scale(1); opacity: 0.5; }
  70%, 100% { transform: scale(2.8); opacity: 0; }
}

.gs-icon-btn {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  padding: 0;
  background: none; border: none;
  border-radius: 50%;
  color: var(--ink-soft);
  cursor: pointer;
  transition: color 120ms ease, background 120ms ease;
}
.gs-icon-btn:hover,
.gs-icon-btn.is-on { color: var(--green); background: var(--green-wash); }
.gs-top :focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

/* ---------- page frame ---------- */

.gs-main { max-width: 1120px; margin: 0 auto; padding: 28px 20px 56px; }

.gs-page-head { margin-bottom: 22px; }
.gs-page-title { margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.02em; }
.gs-page-sub { margin-top: 4px; font-size: 14px; color: var(--ink-dim); }

.gs-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.gs-card-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 16px 20px 0;
}
.gs-card-title { margin: 0; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; }
.gs-card-note { font-size: 12.5px; color: var(--ink-dim); }
.gs-card-link,
.gs-page .gs-card-link {
  font-size: 13px; color: var(--ink-soft);
  text-decoration: underline; text-underline-offset: 3px;
}
.gs-page .gs-card-link:hover { color: var(--green); }

.gs-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 13px;
  background: none;
  border: 1px solid var(--line-lit);
  border-radius: 999px;
  color: var(--ink);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.gs-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-wash); }

/* The one filled button. Use it for the main action in a row and nowhere else. */
.gs-btn-solid,
.gs-page .gs-btn-solid {
  background: var(--green);
  border-color: var(--green);
  color: var(--on-green);
  font-weight: 500;
}
.gs-page .gs-btn-solid:hover { background: var(--green-lit); border-color: var(--green-lit); color: var(--on-green); }

@media (max-width: 760px) {
  .gs-top { padding: 0 14px; gap: 10px; }
  .gs-top-left { gap: 14px; }
  .gs-waiting { display: none; }
  .gs-live-label { display: none; }
  .gs-main { padding: 20px 14px 40px; }
}
@media (max-width: 420px) {
  .gs-mark-name { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .gs-page *, .gs-top * { transition: none !important; }
  .gs-live.is-live .gs-live-dot::after { animation: none; }
}
`;
