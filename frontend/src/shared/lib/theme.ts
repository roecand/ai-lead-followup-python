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
  display: flex; align-items: center; gap: 9px;
}
.gs-mark svg { color: var(--green); flex-shrink: 0; }
.gs-mark-text { display: flex; flex-direction: column; line-height: 1; }
.gs-mark-name { font-size: 16px; font-weight: 700; letter-spacing: -0.015em; }
.gs-mark-parent { margin-top: 3px; font-size: 10.5px; font-weight: 500; letter-spacing: 0.02em; color: var(--ink-dim); }

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

/* ---------- appearance ---------- */

.gs-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

.gs-ap { position: relative; }

.gs-ap-panel {
  position: absolute; top: calc(100% + 10px); right: -46px; z-index: 20;
  width: 280px;
  padding: 14px 10px 12px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: calc(var(--radius) + 4px);
  box-shadow: 0 16px 40px -12px var(--shadow), 0 2px 6px var(--shadow);
  transform-origin: top right;
  animation: gs-pop 150ms ease-out both;
}
@keyframes gs-pop { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }

.gs-ap-title { padding: 0 8px 8px; font-size: 13px; font-weight: 600; color: var(--ink); }
.gs-ap-note { padding: 10px 8px 0; margin-top: 6px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-dim); line-height: 1.4; }

.gs-themes { border: 0; margin: 0; padding: 0; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

.gs-theme {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  padding: 8px;
  border-radius: var(--radius);
  cursor: pointer;
  transition: background 110ms ease;
}
.gs-theme:hover { background: var(--hover); }
.gs-theme.is-on { background: var(--green-wash); }
.gs-theme input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.gs-theme:has(input:focus-visible) { outline: 2px solid var(--green); outline-offset: 1px; }

/* A tiny picture of the theme: page, a panel on it, and the accent. */
.gs-theme-chip {
  position: relative; flex: none;
  width: 40px; height: 28px;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(127, 127, 127, 0.3);
}
.gs-theme-chip-card {
  position: absolute; left: 7px; right: 7px; top: 7px; bottom: 0;
  background: var(--chip-card);
  border-radius: 3px 3px 0 0;
}
.gs-theme-chip-dot {
  position: absolute; left: 12px; top: 12px;
  width: 7px; height: 7px; border-radius: 50%;
}
/* Auto shows half light, half dark. */
.gs-theme-chip.is-split::after {
  content: ""; position: absolute; inset: 0 0 0 50%;
  background: #0F1311; z-index: 0;
}
.gs-theme-chip.is-split .gs-theme-chip-card { background: #FDFCF9; z-index: 1; right: 50%; }
.gs-theme-chip.is-split .gs-theme-chip-dot { z-index: 2; left: auto; right: 9px; }

.gs-theme-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
.gs-theme-label { font-size: 14px; color: var(--ink); }
.gs-theme.is-on .gs-theme-label { font-weight: 500; color: var(--green-ink); }
.gs-theme-note { font-size: 12px; color: var(--ink-dim); }

.gs-theme-check { margin-left: auto; color: var(--green); opacity: 0; }
.gs-theme.is-on .gs-theme-check { opacity: 1; }

@media (max-width: 760px) {
  .gs-top { padding: 0 14px; gap: 10px; }
  .gs-top-left { gap: 14px; }
  .gs-waiting { display: none; }
  .gs-live-label { display: none; }
  .gs-main { padding: 20px 14px 40px; }
  .gs-ap-panel { position: fixed; top: calc(var(--top-h) + 8px); right: 14px; left: auto; }
}
@media (max-width: 420px) {
  .gs-mark-text { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .gs-page *, .gs-top * { transition: none !important; }
  .gs-live.is-live .gs-live-dot::after { animation: none; }
  .gs-ap-panel { animation: none; }
}
`;