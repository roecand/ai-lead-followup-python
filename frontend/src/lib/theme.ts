/**
 * Shared look for the dashboard and settings pages.
 * Same palette and font as ConversationsPage, scoped under .gs-page so it can
 * never leak into other screens. Change the values at the top of .gs-page to
 * restyle everything that uses this.
 */
export const THEME_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600;700&display=swap');

.gs-page {
  --paper:      #F5F4EF;
  --card:       #FDFCF9;
  --ink:        #16241C;
  --ink-soft:   #4B5D53;
  --ink-dim:    #7B8A81;
  --line:       #DEDCD3;
  --line-lit:   #C2BFB2;
  --green:      #1E5138;
  --green-lit:  #2A6B4A;
  --green-wash: #E7EFE9;
  --flag:       #A06A12;
  --alert:      #A8412A;
  --sink:       #E7E4DB;
  --radius:     4px;
  --top-h:      56px;

  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: 'Familjen Grotesk', system-ui, sans-serif;
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
}

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

.gs-top-right { display: flex; align-items: center; gap: 14px; }

.gs-waiting {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: var(--flag);
}
.gs-waiting-clear { color: var(--ink-dim); font-weight: 400; }
.gs-dot-sun { width: 6px; height: 6px; border-radius: 50%; background: var(--flag); }

.gs-cog {
  display: grid; place-items: center;
  width: 36px; height: 36px;
  border-radius: 50%;
  color: var(--ink-soft);
  transition: color 120ms ease, background 120ms ease;
}
.gs-cog:hover { color: var(--green); background: var(--green-wash); }
.gs-cog.is-on { color: var(--green); background: var(--green-wash); }

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
.gs-card-link {
  font-size: 13px; color: var(--ink-soft);
  text-decoration: underline; text-underline-offset: 3px;
}
.gs-card-link:hover { color: var(--green); }

.gs-btn {
  display: inline-block;
  padding: 6px 13px;
  background: none;
  border: 1px solid var(--line-lit);
  border-radius: 999px;
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease, background 120ms ease;
}
.gs-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-wash); }

@media (max-width: 760px) {
  .gs-top { padding: 0 14px; }
  .gs-top-left { gap: 14px; }
  .gs-waiting { display: none; }
  .gs-main { padding: 20px 14px 40px; }
}

@media (prefers-reduced-motion: reduce) {
  .gs-page * { transition: none !important; }
}
`;