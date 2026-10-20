/**
 * Styles shared by the sign-in and sign-up pages. Both pages render
 * <style>{AUTH_CSS}</style> once at the top.
 *
 * The auth pages keep their own fixed dusk palette (scoped to .lf-root)
 * instead of the app themes, so they look the same for everyone.
 */
export const AUTH_CSS = `
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
  overflow: clip; /* like hidden, but nothing (not even focus) can scroll it sideways mid-slide */
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
  .lf-stars::after,
  .lf-check.is-drawing path,
  .lf-step.is-arriving .lf-step-num { animation: none; }
}

/* ===========================================================================
   SIGN-UP ONLY
   =========================================================================== */

/* Small helper line under a field. */
.lf-hint {
  margin-top: 6px !important;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--sage);
  opacity: 0.85;
}
.lf-hint.is-warn { color: var(--sun); opacity: 1; }

/* Join codes are random letters, so a mono face makes 0/O and l/I easy to tell apart. */
.lf-input-code {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 15px;
  letter-spacing: 0.04em;
}

/* "How joining works" list, in the same frame as the login's sample thread. */
.lf-steps {
  list-style: none;
  margin: 32px 0 0;
  padding: 8px 0;
  max-width: 440px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(16, 27, 21, 0.6);
}

.lf-step {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
}
.lf-step + .lf-step { border-top: 1px solid var(--line); }

.lf-step-num {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid rgba(217, 164, 65, 0.55);
  color: var(--sun);
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.lf-step-body { display: flex; flex-direction: column; gap: 3px; padding-top: 2px; }
.lf-step-title { font-size: 15px; font-weight: 600; }
.lf-step-text { font-size: 13.5px; line-height: 1.45; color: var(--sage); }

@media (max-width: 980px) {
  .lf-steps { display: none; }
}

@media (min-width: 1600px) {
  .lf-hint { font-size: 13.5px; }
  .lf-input-code { font-size: 16.5px; }
  .lf-steps { max-width: 520px; margin-top: 40px; border-radius: 22px; padding: 10px 0; }
  .lf-step { padding: 18px 22px; gap: 16px; }
  .lf-step-num { width: 30px; height: 30px; font-size: 14px; }
  .lf-step-title { font-size: 17px; }
  .lf-step-text { font-size: 15px; }
}

/* ---------- compact card (sign-up has six fields, so it needs to be tighter) ---------- */

.lf-card-compact { padding: 26px 28px 22px; }
.lf-card-compact .lf-card-title { margin-bottom: 16px; font-size: 21px; }
.lf-card-compact .lf-field { margin-bottom: 11px; }
.lf-card-compact .lf-label { margin-bottom: 5px; font-size: 13px; }
.lf-card-compact .lf-input { padding: 9px 12px; font-size: 15px; }
.lf-card-compact .lf-hint { margin-top: 5px !important; font-size: 12px; }
.lf-card-compact .lf-error-slot { min-height: 18px; margin: 6px 0 4px; }
.lf-card-compact .lf-submit { padding: 11px 16px; }
.lf-card-compact .lf-foot { margin-top: 16px !important; }

/* Password and confirm sit side by side. */
.lf-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
/* Show and the label share a text baseline. Show gets the same bottom margin as
   the label, so the row is the same height as the Confirm column's row. */
.lf-pair .lf-label-row { align-items: baseline; }
.lf-pair .lf-reveal { margin-bottom: 5px; line-height: inherit; font-size: 12.5px; }

@media (max-width: 640px) {
  .lf-card-compact { padding: 22px 18px 18px; }
  .lf-pair { gap: 8px; }
}

@media (min-width: 1600px) {
  .lf-card-compact { padding: 34px 36px 28px; }
  .lf-card-compact .lf-card-title { font-size: 26px; margin-bottom: 20px; }
  .lf-card-compact .lf-field { margin-bottom: 14px; }
  .lf-card-compact .lf-label { font-size: 14.5px; }
  .lf-card-compact .lf-input { padding: 11px 14px; font-size: 16.5px; }
  .lf-card-compact .lf-hint { font-size: 13px; }
  .lf-card-compact .lf-submit { padding: 13px 16px; font-size: 16.5px; }
}

/* ===========================================================================
   VERIFY EMAIL
   =========================================================================== */

/* Read by screen readers, hidden on screen. */
.lf-sr {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Step states on the joining panel. */
.lf-step.is-done .lf-step-num {
  background: rgba(217, 164, 65, 0.14);
  border-color: rgba(217, 164, 65, 0.35);
}
.lf-step.is-done .lf-step-title,
.lf-step.is-done .lf-step-text { opacity: 0.6; }

.lf-step.is-current { background: rgba(217, 164, 65, 0.06); }
.lf-step.is-current .lf-step-num {
  background: var(--sun);
  border-color: var(--sun);
  color: #14211A;
}

.lf-step.is-next .lf-step-num { border-color: var(--line-lit); color: var(--sage); }
.lf-step.is-next .lf-step-title { color: var(--sage); }

/* First and last rows are rounded so the lit row fits the panel's corners. */
.lf-steps { overflow: hidden; padding: 0; }

.lf-mail-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  margin-bottom: 14px;
  border-radius: 50%;
  background: rgba(217, 164, 65, 0.12);
  border: 1px solid rgba(217, 164, 65, 0.35);
  color: var(--sun);
}

.lf-sent {
  margin: -6px 0 18px !important;
  font-size: 14px;
  line-height: 1.5;
  color: var(--sage);
}
.lf-sent strong { color: var(--bone); font-weight: 600; word-break: break-all; }

/* One wide box with spaced digits, easier than six boxes for paste and autofill. */
.lf-card .lf-input.lf-code {
  padding: 12px 14px;
  text-align: center;
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.5em;
  text-indent: 0.5em; /* balances the trailing letter-spacing so digits sit centered */
}
.lf-card .lf-input.lf-code::placeholder { color: var(--line-lit); }

.lf-notice { color: var(--sun); font-size: 13.5px; line-height: 1.4; }

.lf-resend {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: var(--sage);
}
.lf-reveal:disabled {
  cursor: default;
  text-decoration: none;
  opacity: 0.75;
}
.lf-reveal:disabled:hover { color: var(--sage); }

.lf-submit-link {
  display: block;
  margin-top: 6px;
  text-align: center;
  text-decoration: none;
}

@media (min-width: 1600px) {
  .lf-mail-mark { width: 48px; height: 48px; }
  .lf-sent { font-size: 15.5px; }
  .lf-card .lf-input.lf-code { font-size: 30px; padding: 14px 16px; }
  .lf-resend { font-size: 14.5px; }
}

/* ===========================================================================
   PAGE SLIDES (AuthShell)
   =========================================================================== */

/* The leaving page and the arriving page sit in the same grid cell, so they
   overlap while one slides out and the other slides in. */
.lf-slides {
  position: relative;
  z-index: 1;
  display: grid;
}

.lf-slide {
  grid-area: 1 / 1;
  min-width: 0;
  will-change: transform, opacity;
}

/* ===========================================================================
   STEP COMPLETES (JoinSteps)
   A step finishing fades its row, swaps its number for a check that draws
   itself, and the highlight eases down onto the next row.
   =========================================================================== */

.lf-step { transition: background-color 450ms ease; }
.lf-step-num {
  transition: background-color 450ms ease, border-color 450ms ease, color 450ms ease;
}
.lf-step-title,
.lf-step-text { transition: opacity 450ms ease, color 450ms ease; }

.lf-check.is-drawing path {
  stroke-dasharray: 1;
  animation: lf-draw 420ms ease-out both;
}

@keyframes lf-draw {
  from { stroke-dashoffset: 1; }
  to   { stroke-dashoffset: 0; }
}

/* The newly current number gives one small pulse. */
.lf-step.is-arriving .lf-step-num {
  animation: lf-pop 420ms ease-out 120ms both;
}

@keyframes lf-pop {
  0%   { transform: scale(1); }
  45%  { transform: scale(1.16); }
  100% { transform: scale(1); }
}

/* ===========================================================================
   SECURE ACCOUNT (the optional authenticator step after verify)
   The setup flow itself is styled in features/security/securityStyles.ts.
   =========================================================================== */

.lf-secure-later {
  display: block;
  margin-top: 8px;
  font-size: 12.5px;
  opacity: 0.85;
}

@media (min-width: 1600px) {
  .lf-secure-later { font-size: 13.5px; }
}
`;