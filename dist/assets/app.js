// Intend app preview: a calm daily dashboard.
// Each view is written as an HTML string and then "morphed" onto the live page: only what changed is
// touched, so a tap never flashes the whole page, CSS transitions can play, and focus stays put.
// Everything lives in page memory only (see state.js). No storage, no network.
import {createState, MOODS, SAMPLE_WEEK, escapeHTML as esc, addHabit, toggleHabit, changeWater, submitReflection} from './state.js';
import {createSounds} from './sound.js';

const WATER_GOAL = 8;
const GLASS_ML = 250;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const sounds = createSounds();
const root = document.querySelector('#app');
let state = createState();
let ui = freshUi();
let toastTimer;
function freshUi() {
  return {view: 'today', sound: true, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day', period: 7, flow: null, quickMood: 0, shown: new Set(), lastFocus: null};
}
const sound = (kind, options) => { if (ui.sound) sounds.play(kind, options); };

/* Line icons (no emoji anywhere) */
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  journal: '<path d="M6 3h11a1 1 0 0 1 1 1v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1Z"/><path d="M5 17a2 2 0 0 1 2-2h11M9 7h5M9 10h3"/>',
  patterns: '<path d="M4 4v16h16"/><path d="m7 14 3.5-4 3 2.5L19 7"/>',
  recipe: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z"/><path d="M5 19 13 11"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  soundOn: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  soundOff: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="m17 10 4 4M21 10l-4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  sunrise: '<path d="M4 18h16M7.5 18a4.5 4.5 0 0 1 9 0M12 7v2.5M5.6 10.6l1.7 1.7M18.4 10.6l-1.7 1.7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  drop: '<path d="M12 3.5c3 3.6 6 7.1 6 10.5a6 6 0 0 1-12 0c0-3.4 3-6.9 6-10.5Z"/>',
  sparkle: '<path d="M12 3.5c.6 4.4 2.3 6.1 6.5 6.7-4.2.6-5.9 2.3-6.5 6.7-.6-4.4-2.3-6.1-6.5-6.7 4.2-.6 5.9-2.3 6.5-6.7Z"/><path d="M18.5 16.5v3M17 18h3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z"/><path d="M5 19 13 11"/>',
  bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
  people: '<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="10" r="2.4"/><path d="M15.5 14.6A4.5 4.5 0 0 1 21 19"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8.5 20.5a7.5 7.5 0 0 1 15 0Z" fill="#b07c48"/><path d="M4 23.5h24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10.5 27h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".4"/></svg>';
const VIEWS = [['today', 'Today'], ['journal', 'Journal'], ['patterns', 'Patterns'], ['recipe', 'My recipe'], ['settings', 'My space']];

/* Helpers */
const dateLabel = () => new Intl.DateTimeFormat(undefined, {weekday: 'long', month: 'long', day: 'numeric'}).format(new Date());
const weekday = daysAgo => new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(new Date(Date.now() - daysAgo * 864e5));
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return state.name ? `${part}, <em>${esc(state.name)}</em>.` : `${part}.`;
}
function skyPhase() {
  const h = new Date().getHours();
  return h < 5 ? 'night' : h < 11 ? 'morning' : h < 17 ? 'day' : h < 21 ? 'dusk' : 'night';
}
const skyClass = () => { const phase = skyPhase(); return `sky-${phase}${phase === 'night' || ui.theme === 'night' ? ' sky-dark' : ''}`; };
const SKY = '<div class="sky" aria-hidden="true"><i class="sky-stars"></i><i class="sky-glow"></i><i class="sky-orb"></i><i class="sky-sea"></i><i class="sky-line"></i></div>';
const habitsDone = () => state.habits.filter(h => h.done).length;
const checkins = () => (state.morning ? 1 : 0) + (state.evening ? 1 : 0);
function progress() {
  const parts = [state.morning ? 1 : 0, state.evening ? 1 : 0, state.habits.length ? habitsDone() / state.habits.length : 0, Math.min(1, state.water / WATER_GOAL)];
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
}
const todayMood = () => state.evening?.mood || state.morning?.mood || ui.quickMood || 0;
const nextMode = () => !state.morning ? 'morning' : !state.evening ? 'evening' : null;
const waterLevel = n => Math.min(n, WATER_GOAL) / WATER_GOAL * .86;
function litres(n) { const l = n * GLASS_ML / 1000; return Number.isInteger(l) ? String(l) : l.toFixed(2).replace(/0$/, ''); }

/* Rendering: build markup, then morph it onto the page. */
function render({focus = false} = {}) {
  document.body.dataset.theme = ui.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ui.theme === 'night' ? '#100e0c' : '#f2eee6');
  const next = document.createElement('div');
  next.innerHTML = shell(({today, journal, patterns, recipe, settings})[ui.view]());
  const tweens = [];
  if (root.querySelector('.app-shell')) morphChildren(root, next, tweens);
  else root.replaceChildren(...next.childNodes);
  applyVars(root);
  tweens.forEach(([el, from, to]) => countUp(el, from, to));
  if (focus) root.querySelector('#app-content h1')?.focus({preventScroll: true});
}

// Elements carry their dynamic values as data-vars="--name:value;..." (the CSP forbids inline styles,
// but setting custom properties through the CSSOM is allowed).
function applyVars(scope) {
  scope.querySelectorAll('[data-vars]').forEach(el => {
    for (const pair of el.dataset.vars.split(';')) {
      const i = pair.indexOf(':');
      if (i < 0) continue;
      const name = pair.slice(0, i).trim(), value = pair.slice(i + 1).trim();
      if (name.startsWith('--') && el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
    }
  });
}

// A small DOM morph. Elements are matched by position; a different tag or data-key means "replace".
// Classes starting with fx- belong to running effects and are kept. The style attribute is never touched.
function morph(live, next, tweens) {
  for (const {name} of [...live.attributes]) if (name !== 'style' && name !== 'class' && !next.hasAttribute(name)) live.removeAttribute(name);
  for (const {name, value} of [...next.attributes]) {
    if (name === 'class') continue;
    const old = live.getAttribute(name);
    if (old === value) continue;
    live.setAttribute(name, value);
    if (name === 'data-count' && old !== null) tweens.push([live, Number(old), Number(value)]);
  }
  const keep = [...live.classList].filter(c => c.startsWith('fx-'));
  const cls = [next.getAttribute('class') || '', ...keep].join(' ').trim();
  if ((live.getAttribute('class') || '') !== cls) cls ? live.setAttribute('class', cls) : live.removeAttribute('class');
  morphChildren(live, next, tweens);
}
function morphChildren(live, next, tweens) {
  const a = [...live.childNodes], b = [...next.childNodes];
  b.forEach((y, i) => {
    const x = a[i];
    if (!x) live.append(y);
    else if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && x.getAttribute('data-key') !== y.getAttribute('data-key'))) x.replaceWith(y);
    else if (x.nodeType === 1) morph(x, y, tweens);
    else if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue;
  });
  for (let i = b.length; i < a.length; i++) a[i].remove();
}

/* Small motion helpers */
const fxTimers = new WeakMap();
function replay(el, cls, ms) {
  if (!el || reduced) return;
  const timers = fxTimers.get(el) || {};
  clearTimeout(timers[cls]);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  timers[cls] = setTimeout(() => el.classList.remove(cls), ms);
  fxTimers.set(el, timers);
}
function countUp(el, from, to) {
  if (reduced || from === to || !Number.isFinite(from)) return;
  cancelAnimationFrame(el._tween);
  const start = performance.now(), ms = 900;
  const step = now => {
    const k = Math.min(1, (now - start) / ms), eased = 1 - (1 - k) ** 3;
    el.textContent = Math.round(from + (to - from) * eased);
    if (k < 1) el._tween = requestAnimationFrame(step);
  };
  el._tween = requestAnimationFrame(step);
}
// The old number slides out while the new one slides in.
function roll(el, from, to, up) {
  if (!el || reduced || String(from) === String(to)) return;
  el.innerHTML = `<span class="roll-old">${esc(String(from))}</span><span class="roll-new">${esc(String(to))}</span>`;
  el.dataset.dir = up ? 'up' : 'down';
  clearTimeout(el._roll);
  el._roll = setTimeout(() => { el.textContent = String(to); delete el.dataset.dir; }, 560);
}

/* Shell */
function shell(main) {
  const nav = VIEWS.map(([key, label]) => `<button class="nav-item" data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${label}</span>${key === 'today' && !state.morning ? '<span class="nav-dot" aria-hidden="true"></span><span class="sr-only">, morning check-in waiting</span>' : ''}</button>`).join('');
  return `<div class="app-shell">
    <aside class="app-sidebar">
      <a href="/" class="brand" aria-label="Intend website">${LOGO}<span>intend</span></a>
      <nav class="app-nav" aria-label="App">${nav}</nav>
      <div class="sidebar-bottom">
        <p class="sidebar-quote">Your pace.<br><em>Your space.</em></p>
        <div class="sidebar-links"><a href="/">Website</a><a href="/privacy/" target="_blank" rel="noopener">Privacy</a><a href="/terms/" target="_blank" rel="noopener">Terms</a></div>
        <a class="sidebar-credit" href="https://otoro.si" target="_blank" rel="noopener noreferrer"><span>Built and secured with</span><b>Orso Solutions × OTORO</b></a>
      </div>
    </aside>
    <main class="app-main" id="app-content" tabindex="-1" data-key="view-${ui.view}">${main}</main>
  </div>
  <nav class="mobile-tabs" aria-label="App">${VIEWS.map(([key, label]) => `<button data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${({recipe: 'Recipe', settings: 'You'})[key] || label}</span></button>`).join('')}</nav>`;
}
function topBar(title, subtitle) {
  return `<header class="app-top">
    <div class="app-heading"><p class="app-date">${dateLabel()}</p><h1 tabindex="-1">${title}</h1><p class="app-sub">${subtitle}</p></div>
    <div class="top-actions">
      <button class="icon-button" data-action="sound" aria-pressed="${ui.sound}" aria-label="Sounds" title="${ui.sound ? 'Sounds on' : 'Sounds off'}">${icon(ui.sound ? 'soundOn' : 'soundOff')}</button>
      <button class="icon-button" data-action="theme" aria-pressed="${ui.theme === 'night'}" aria-label="Evening look" title="${ui.theme === 'night' ? 'Evening look' : 'Day look'}">${icon(ui.theme === 'night' ? 'moon' : 'sun')}</button>
      <button class="avatar" data-view="settings" aria-label="My space">${esc((state.name || 'You').slice(0, 1).toUpperCase())}</button>
    </div></header>`;
}

/* Shared pieces */
function moodScale(selected, attr) {
  return `<div class="mood-scale" role="group" aria-label="How do you feel, from 1 to 5" data-selected="${selected ? 'yes' : 'no'}" data-vars="--sel:${Math.max(0, selected - 1)}">
    <span class="mood-indicator" aria-hidden="true"></span>
    ${MOODS.map((m, i) => `<button class="mood-option mood-${i + 1}" ${attr}="mood" data-mood="${i + 1}" aria-pressed="${selected === i + 1}"><span class="orb" aria-hidden="true"></span><span class="mood-text"><span class="mood-num">${i + 1}</span><span class="mood-name">${m}</span></span></button>`).join('')}
  </div>`;
}
// Smooth line through the points without overshooting (monotone cubic).
function smoothPath(pts) {
  const n = pts.length, f = v => v.toFixed(1);
  if (n < 2) return '';
  const dx = [], m = [], t = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${f(pts[i][0] + h)} ${f(pts[i][1] + t[i] * h)} ${f(pts[i + 1][0] - h)} ${f(pts[i + 1][1] - t[i + 1] * h)} ${f(pts[i + 1][0])} ${f(pts[i + 1][1])}`;
  }
  return d;
}
function chartSvg(values, labels, {key, today = -1}) {
  const w = 640, h = 220, px = 26, top = 20, bottom = 36;
  const y = v => top + (1 - (v - 1) / 4) * (h - top - bottom);
  const step = (w - px * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [px + i * step, y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${h - bottom} L${pts[0][0].toFixed(1)} ${h - bottom} Z`;
  const every = values.length > 10 ? 5 : 1;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mood over ${values.length} days, out of five" data-key="${key}">
    <defs><linearGradient id="${key}-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="stop-top"/><stop offset="1" class="stop-bottom"/></linearGradient></defs>
    <g class="grid">${[1, 2, 3, 4, 5].map(v => `<line x1="${px}" x2="${w - px}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('')}</g>
    <line class="guide" x1="${px}" x2="${px}" y1="${top}" y2="${h - bottom}"/>
    <path class="area" d="${area}" fill="url(#${key}-fill)"/>
    <path class="line" d="${line}" pathLength="1"/>
    ${pts.map((p, i) => `<circle class="point${i === today ? ' is-today' : ''}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === today ? 6 : 4}" tabindex="0" data-day="${esc(labels[i])}" data-mood="${MOODS[Math.round(values[i]) - 1] || 'Steady'}" aria-label="${esc(labels[i])}: ${MOODS[Math.round(values[i]) - 1] || 'Steady'}"/>`).join('')}
    ${labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? `<text x="${pts[i][0].toFixed(1)}" y="${h - 10}" text-anchor="middle"${i === today ? ' class="is-today"' : ''}>${esc(l)}</text>` : '').join('')}
  </svg>`;
}

/* Today */
function today() {
  const mode = nextMode();
  return `${topBar(greeting(), 'Your space to check in, reflect and notice what makes a good day.')}
  <div class="bento">${heroTile(mode)}${ringsTile()}${moodTile()}${waterTile()}${habitsTile()}${weekTile()}${eveningTile()}</div>`;
}
function heroTile(mode) {
  const m = state.morning, e = state.evening;
  const copy = !m
    ? {label: 'Your morning · about 2 minutes', title: 'Make room for something good.', text: 'Two minutes to decide how you want to show up today.'}
    : {label: 'Today’s intention', title: m.intention ? esc(m.intention) : 'A day of your own making.', text: e ? 'Both bookends done. Tomorrow is a new page.' : `You started the day feeling ${MOODS[m.mood - 1].toLowerCase()}.`};
  const cta = mode
    ? `<button class="button" data-action="flow" data-mode="${mode}">${mode === 'morning' ? 'Begin morning check-in' : 'Begin evening reflection'} ${icon('arrow')}</button>`
    : `<button class="button ghost" data-view="journal">Read today’s pages ${icon('arrow')}</button>`;
  const end = (done, name, ic) => `<span class="bookend${done ? ' is-done' : ''}">${icon(done ? 'check' : ic)}<span>${name}<span class="sr-only">${done ? ', done' : ', not yet'}</span></span></span>`;
  return `<section class="tile t-hero ${skyClass()}" data-key="hero" aria-labelledby="t-intent">${SKY}
    <div class="hero-copy" data-key="copy-${mode || 'done'}"><p class="label">${copy.label}</p><h2 id="t-intent">${copy.title}</h2><p class="hero-text">${copy.text}</p>${cta}</div>
    <div class="bookends">${end(m, 'Morning', 'sunrise')}<i class="bookend-line${m ? ' is-done' : ''}"></i>${end(e, 'Evening', 'moon')}</div>
  </section>`;
}
function ringsTile() {
  const pct = progress();
  const parts = [
    {key: 'checkins', label: 'Check-ins', value: checkins(), total: 2},
    {key: 'habits', label: 'Habits', value: habitsDone(), total: state.habits.length},
    {key: 'water', label: 'Water', value: Math.min(state.water, WATER_GOAL), total: WATER_GOAL, shown: state.water}
  ];
  const radii = [86, 68, 50];
  const rings = parts.map((p, i) => {
    const frac = p.total ? Math.min(1, p.value / p.total) : 0;
    return `<circle class="ring-track ring-${p.key}" cx="100" cy="100" r="${radii[i]}"/><circle class="ring-fill ring-${p.key}${frac >= 1 ? ' is-full' : ''}" cx="100" cy="100" r="${radii[i]}" pathLength="100" data-empty="${frac === 0}" data-vars="--p:${frac.toFixed(3)}"/>`;
  }).join('');
  return `<section class="tile t-rings" data-key="rings" aria-labelledby="t-progress">
    <div class="tile-head"><div><p class="label">Today</p><h2 id="t-progress">Your day so far</h2></div></div>
    <div class="rings" role="img" aria-label="${pct}% of today complete"><svg viewBox="0 0 200 200" aria-hidden="true">${rings}</svg>
      <div class="rings-center" aria-hidden="true"><strong><span data-count="${pct}">${pct}</span><small>%</small></strong><span>of today</span></div></div>
    <ul class="legend">${parts.map(p => `<li><i class="dot dot-${p.key}" aria-hidden="true"></i><span>${p.label}</span><b>${p.shown ?? p.value}<small> / ${p.total}</small></b></li>`).join('')}</ul>
  </section>`;
}
function moodTile() {
  const sel = todayMood();
  return `<section class="tile t-mood" data-key="mood" aria-labelledby="t-mood">
    <div class="tile-head"><div><p class="label">Quick check</p><h2 id="t-mood">How are you, right now?</h2></div><span class="pill${sel ? '' : ' is-quiet'}">${sel ? MOODS[sel - 1] : 'Tap one'}</span></div>
    ${moodScale(sel, 'data-action')}
  </section>`;
}
const WAVE = cls => `<svg class="wave ${cls}" viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true"><path d="M0 6Q50 0 100 6T200 6T300 6T400 6V12H0Z"/></svg>`;
// Tick marks sit at 2, 4 and 6 glasses on the right wall of the glass.
const GLASS = `<svg class="vessel-glass" viewBox="0 0 150 206" aria-hidden="true">
  <path class="glass-wall" d="M3 1 15 188Q16.4 206 34.5 206H115.5Q133.6 206 135 188L147 1"/>
  <path class="glass-rim" d="M3 1H147"/>
  <path class="glass-shine" d="M15 16 24 168"/><path class="glass-shine soft" d="M134 22 131.5 64"/>
  <path class="glass-tick" d="M127 161.7h7M130 117.4h7M133 73.1h7"/>
</svg>`;
function waterTitle(n) { return n >= WATER_GOAL ? 'Well topped up.' : n >= WATER_GOAL / 2 ? 'Over halfway.' : n ? 'Keep it flowing.' : 'A glass at a time.'; }
function waterTile() {
  const n = state.water, extra = Math.max(0, n - WATER_GOAL);
  return `<section class="tile t-water" data-key="water" aria-labelledby="t-water">
    <div class="tile-head"><div><p class="label">Water</p><h2 id="t-water">${waterTitle(n)}</h2></div><span class="pill pill-water">${icon('drop')}<span class="roll" data-roll="glasses">${n}</span><span class="pill-of">/ ${WATER_GOAL}</span></span></div>
    <div class="water-stage">
      <div class="vessel${n >= WATER_GOAL ? ' is-full' : ''}" data-vessel data-empty="${n === 0}" data-vars="--lv:${waterLevel(n).toFixed(3)}">
        <span class="pour" aria-hidden="true"></span>
        <div class="vessel-body" aria-hidden="true">
          <div class="liquid"><div class="waves">${WAVE('wave-back')}${WAVE('wave-front')}</div><div class="bubbles"><i></i><i></i><i></i><i></i><i></i><i></i></div><i class="shimmer"></i></div>
          <div class="splash"><i></i><i></i><i></i><i></i><i></i><b class="ripple"></b></div>
        </div>
        ${GLASS}
        <span class="extra${extra ? '' : ' is-hidden'}" aria-hidden="true">+${extra}</span>
      </div>
    </div>
    <div class="pips" aria-hidden="true">${[...Array(WATER_GOAL)].map((_, i) => `<i class="pip${i < n ? ' is-full' : ''}" data-i="${i}"></i>`).join('')}</div>
    <div class="water-foot">
      <p class="water-amount"><strong><span class="roll" data-roll="litres">${litres(n)}</span><small>L</small></strong><span>of ${litres(WATER_GOAL)} L today</span></p>
      <div class="water-actions">
        <button class="round-button" data-action="water" data-amount="-1" aria-label="Remove a glass">${icon('minus')}</button>
        <button class="pill-button" data-action="water" data-amount="1">${icon('plus')}<span>Add a glass</span></button>
      </div>
    </div>
    <p class="sr-only" aria-live="polite">${n} of ${WATER_GOAL} glasses${extra ? `, ${extra} over your goal` : ''}.</p>
  </section>`;
}
const habitRow = h => `<button class="habit" data-key="habit-${h.id}" data-action="habit" data-id="${h.id}" aria-pressed="${h.done}"><span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5"/><path d="m7.6 12.3 3 3 5.8-6.2" pathLength="1"/></svg></span><span class="habit-name">${esc(h.name)}</span></button>`;
function habitsTile() {
  const done = habitsDone(), total = state.habits.length;
  return `<section class="tile t-habits" data-key="habits" aria-labelledby="t-habits">
    <div class="tile-head"><div><p class="label">Habits</p><h2 id="t-habits">${total && done === total ? 'Every step, done.' : 'Small steps.'}</h2></div><span class="pill"><span data-count="${done}">${done}</span><span class="pill-of">/ ${total}</span></span></div>
    <div class="meter" aria-hidden="true"><i data-vars="--p:${total ? (done / total).toFixed(3) : 0}"></i></div>
    <div class="habit-list">${state.habits.map(habitRow).join('')}</div>
    <div class="habit-add"><span class="habit-add-icon" aria-hidden="true">${icon('plus')}</span><label class="sr-only" for="new-habit">New habit</label><input id="new-habit" maxlength="60" placeholder="Add a habit" autocomplete="off"><button class="small-button" data-action="add-habit">Add</button></div>
  </section>`;
}
function weekTile() {
  const values = SAMPLE_WEEK.slice(0, 6).concat(todayMood() || SAMPLE_WEEK[6]);
  const days = [...Array(7)].map((_, i) => i === 6 ? 'Today' : weekday(6 - i));
  return `<section class="tile t-week" data-key="week" aria-labelledby="t-week">
    <div class="tile-head"><div><p class="label">This week · sample and today</p><h2 id="t-week">Mood at a glance.</h2></div><button class="ghost-button" data-view="patterns">Patterns ${icon('arrow')}</button></div>
    <div class="chart-wrap">${chartSvg(values, days, {key: 'week', today: 6})}</div>
  </section>`;
}
function eveningTile() {
  const e = state.evening;
  return `<section class="tile t-eve" data-key="eve" aria-labelledby="t-evening">
    <div class="eve-sky" aria-hidden="true"><i class="eve-stars"></i><i class="moon"></i></div>
    <p class="label">${e ? 'One word for today' : 'Tonight'}</p>
    <h2 id="t-evening">${e?.word ? esc(e.word) : e ? 'A full day.' : 'What’s staying with you?'}</h2>
    <p>${e ? 'Tomorrow is a new page.' : 'The good bits, the hard bits, and one word to remember the day by.'}</p>
    <p class="eve-time">${icon(e ? 'check' : 'clock')}<span>${e ? 'Evening reflection done' : `Evening reflection around ${esc(state.reminderEvening)}`}</span></p>
  </section>`;
}

/* Journal */
function entry(mode) {
  const e = state[mode];
  if (!e) return '';
  const labels = mode === 'morning' ? [['intention', 'Intention'], ['gratitude', 'Grateful for'], ['great', 'Would make today great'], ['mustDo', 'Must do']]
    : [['body', 'Body'], ['mind', 'Mind'], ['good', 'Good things'], ['word', 'Word of the day'], ['promise', 'For tomorrow']];
  const rows = labels.filter(([k]) => e[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(e[k])}</dd>`).join('');
  return `<article class="tile entry" data-key="entry-${mode}"><div class="tile-head"><div><p class="label">${mode === 'morning' ? 'Morning check-in' : 'Evening reflection'}</p><h2><span class="orb mood-${e.mood}" aria-hidden="true"></span>Feeling ${MOODS[e.mood - 1].toLowerCase()}</h2></div><button class="ghost-button" data-action="flow" data-mode="${mode}">${icon('pen')} Edit</button></div>${rows ? `<dl>${rows}</dl>` : '<p>Just the check-in today.</p>'}</article>`;
}
function journal() {
  const any = state.morning || state.evening;
  return `${topBar('Journal', 'Today’s pages. They stay in this open page only.')}
  <div class="dash"><div class="span-7 stack">${any ? entry('morning') + entry('evening') : `<div class="tile empty" data-key="empty"><span class="empty-mark" aria-hidden="true">${icon('journal')}</span><p class="label">A fresh page</p><h2>Nothing written yet.</h2><p>Start with a two-minute morning check-in.</p><button class="button" data-action="flow" data-mode="morning">Begin ${icon('arrow')}</button></div>`}</div>
  <section class="tile span-5 note-tile" aria-labelledby="j-week"><p class="label">Weekly note</p><h2 id="j-week">A note to your week.</h2><label class="sr-only" for="weekly-note">Weekly note</label><textarea id="weekly-note" maxlength="1200" placeholder="What do you want to remember about this week?">${esc(state.weeklyNote)}</textarea><div class="row-end"><button class="small-button" data-action="save-note">Keep this note</button></div></section></div>`;
}

/* Patterns */
function series(n) {
  return [...Array(n)].map((_, i) => Math.round(Math.max(1.4, Math.min(5, 3.3 + Math.sin(i * .9) * .9 + Math.cos(i * .37) * .5 + (i % 7 === 3 ? .6 : 0))) * 10) / 10);
}
const insight = (ic, label, title, text) => `<section class="tile span-4 insight"><span class="insight-icon" aria-hidden="true">${icon(ic)}</span><p class="label">${label}</p><h2>${title}</h2><p>${text}</p></section>`;
function patterns() {
  const n = ui.period, values = series(n);
  const labels = values.map((_, i) => n === 7 ? weekday(n - 1 - i) : `Day ${i + 1}`);
  const avg = (values.reduce((a, b) => a + b, 0) / n).toFixed(1);
  return `${topBar('Patterns', 'Illustrative sample data. Associations, never diagnoses.')}
  <div class="dash">
    <section class="tile span-8" data-key="trend" aria-labelledby="p-trend"><div class="tile-head"><div><p class="label">Sample trend</p><h2 id="p-trend">Mood over ${n} days</h2></div>
      <div class="segmented" role="group" aria-label="Period" data-vars="--sel:${n === 7 ? 0 : 1}"><span class="seg-indicator" aria-hidden="true"></span>${[7, 30].map(p => `<button data-action="period" data-period="${p}" aria-pressed="${n === p}">${p} days</button>`).join('')}</div></div>
      <div class="chart-wrap">${chartSvg(values, labels, {key: `trend-${n}`})}</div></section>
    <section class="tile span-4 stat-tile" aria-labelledby="p-avg"><p class="label" id="p-avg">Average</p><p class="big-stat">${avg}<small>/ 5</small></p><p>Best day ${Math.max(...values).toFixed(1)}. Lowest ${Math.min(...values).toFixed(1)}.</p>
      <div class="mini-bars" aria-hidden="true">${[62, 70, 96, 74, 92, 66, 98].map((v, i) => `<i class="${i === 2 || i === 6 ? 'is-best' : ''}" data-vars="--h:${v}%"></i>`).join('')}</div></section>
    ${insight('leaf', 'What lifts you', 'Fresh air.', 'In this sample, days with a walk scored higher.')}
    ${insight('bed', 'Sleep', 'Early nights help.', 'Sample nights over seven hours sit next to steadier mornings.')}
    ${insight('people', 'People', 'Conversations count.', 'Sample days with a real conversation felt warmer.')}
  </div>`;
}

/* Recipe */
function recipe() {
  const item = (ic, value, text) => `<section class="tile span-4 ingredient"><span class="insight-icon" aria-hidden="true">${icon(ic)}</span><strong>${value}</strong><p>${text}</p></section>`;
  return `${topBar('My recipe', 'A sample 30-day recipe for your good days. Personal recipes arrive later.')}
  <div class="dash"><section class="tile t-hero span-12 ${skyClass()}" data-key="recipe-hero">${SKY}<div class="hero-copy"><p class="label">Your good-day recipe · sample</p><h2>A walk, a good talk, and an early night.</h2><p class="hero-text">Built from thirty days of example reflections.</p></div></section>
  ${item('leaf', '4×', 'more good days with time outside')}${item('bed', '7h', 'of sleep before your best mornings')}${item('people', '2', 'real conversations a week, at least')}</div>`;
}

/* Settings */
function settings() {
  const sw = (action, on, label) => `<button class="switch" role="switch" aria-checked="${on}" data-action="${action}" aria-label="${label}"></button>`;
  return `${topBar('My space', 'Make it feel like yours. Preferences stay in this open page only.')}
  <div class="dash"><section class="tile span-7 settings-list" aria-label="Preferences">
    <div class="setting"><div><b>Your name</b><span>For a friendlier hello.</span></div><div class="inline-field"><label class="sr-only" for="pref-name">Your name</label><input id="pref-name" maxlength="40" value="${esc(state.name)}" placeholder="Name or nickname" autocomplete="off"><button class="small-button" data-action="save-name">Save</button></div></div>
    <div class="setting"><div><b>Reflections</b><span>Which bookends you want.</span></div><label class="sr-only" for="pref-style">Reflection style</label><select id="pref-style" data-action="style">${['Both', 'Morning only', 'Evening only'].map(o => `<option ${state.reflectionStyle === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
    <div class="setting"><div><b>Sounds</b><span>Soft tones, and water you can hear.</span></div>${sw('sound', ui.sound, 'Sounds')}</div>
    <div class="setting"><div><b>Evening look</b><span>Warm and dark for later in the day.</span></div>${sw('theme', ui.theme === 'night', 'Evening look')}</div>
    <div class="setting"><div><b>Reminders</b><span>Morning ${esc(state.reminderMorning)}, evening ${esc(state.reminderEvening)}. Arriving with the apps.</span></div></div>
    <div class="setting"><div><b>Start fresh</b><span>Clear everything in this preview.</span></div><button class="ghost-button" data-action="reset">Clear</button></div>
  </section>
  <section class="tile span-5 t-credit"><p class="label">Built and secured with</p><h2>Orso Solutions × OTORO</h2><p>No trackers, no third-party requests, nothing saved. Private by design.</p><a class="button" href="https://otoro.si" target="_blank" rel="noopener noreferrer">Visit OTORO ${icon('arrow')}</a></section></div>`;
}

/* Reflection flow, one question per screen */
const STEPS = {
  morning: [{key: 'mood', q: 'How’s your headspace this morning?'}, {key: 'intention', q: 'How do you want to show up today?', ph: 'Be here for the small things.'}, {key: 'gratitude', q: 'One thing you’re grateful for?', ph: 'Coffee that’s still warm.'}, {key: 'great', q: 'What would make today great?', ph: 'A walk before lunch.'}, {key: 'mustDo', q: 'One thing that has to get done?', ph: 'Call the dentist.'}],
  evening: [{key: 'mood', q: 'How are you feeling tonight?'}, {key: 'body', q: 'How does your body feel?', ph: 'Tired legs, good tired.'}, {key: 'mind', q: 'What’s on your mind?', ph: 'Tomorrow’s meeting.'}, {key: 'good', q: 'Three good things from today?', ph: 'Sun on the walk, a kind message, dinner.'}, {key: 'word', q: 'One word for today?', ph: 'Grounded'}, {key: 'promise', q: 'A small promise for tomorrow?', ph: 'Phone stays out of the bedroom.'}]
};
function startFlow(mode) {
  ui.flow = {mode, step: 0, dir: 'next', draft: state[mode] ? {...state[mode]} : {}};
  ui.lastFocus = document.activeElement;
  sound('tap');
  renderFlow(true);
}
function flowMarkup() {
  const f = ui.flow, steps = STEPS[f.mode], s = steps[f.step], last = f.step === steps.length - 1;
  const body = s.key === 'mood' ? moodScale(f.draft.mood || 0, 'data-flow') : `<label class="sr-only" for="flow-input">${s.q}</label><textarea id="flow-input" maxlength="1200" placeholder="${esc(s.ph)}">${esc(f.draft[s.key] || '')}</textarea>`;
  return `<div class="flow-card" data-dir="${f.dir}">
    <div class="flow-top"><p class="label">${f.mode === 'morning' ? 'Morning check-in' : 'Evening reflection'}</p><span class="flow-count">${f.step + 1} of ${steps.length}</span></div>
    <div class="flow-progress" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= f.step ? 'is-on' : ''}"></i>`).join('')}</div>
    <div class="flow-step" data-key="${f.mode}-${f.step}"><h2 id="flow-q">${s.q}</h2>${body}</div>
    <div class="flow-actions"><button class="plain-button" data-flow="${f.step ? 'back' : 'close'}">${f.step ? 'Back' : 'Not now'}</button>
    <span class="flow-next">${s.key !== 'mood' && !last ? '<button class="plain-button quiet" data-flow="skip">Skip</button>' : ''}<button class="button" data-flow="next">${last ? 'Finish' : 'Continue'} ${icon('arrow')}</button></span></div></div>`;
}
function renderFlow(moveFocus) {
  let el = document.querySelector('.flow:not(.fx-closing)');
  if (!ui.flow) return;
  if (!el) {
    el = document.createElement('div');
    el.className = 'flow';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'flow-q');
    el.innerHTML = flowMarkup();
    document.body.append(el);
    document.body.classList.add('has-flow');
  } else {
    const next = document.createElement('div');
    next.innerHTML = flowMarkup();
    morphChildren(el, next, []);
  }
  applyVars(el);
  if (moveFocus) (el.querySelector('textarea') || el.querySelector('.mood-option[aria-pressed="true"]') || el.querySelector('.mood-option'))?.focus();
}
function closeFlow() {
  ui.flow = null;
  document.body.classList.remove('has-flow');
  const el = document.querySelector('.flow:not(.fx-closing)');
  if (el) { el.classList.add('fx-closing'); setTimeout(() => el.remove(), reduced ? 0 : 280); }
  ui.lastFocus?.focus?.({preventScroll: true});
}
function flowAction(action, target) {
  const f = ui.flow;
  if (!f) return;
  const steps = STEPS[f.mode];
  if (action === 'mood') { f.draft.mood = Number(target.dataset.mood); sound('tap'); renderFlow(false); return; }
  if (action === 'close') { closeFlow(); return; }
  const input = document.querySelector('#flow-input');
  if (input) f.draft[steps[f.step].key] = input.value;
  if (action === 'back') { f.step--; f.dir = 'back'; sound('tap'); renderFlow(true); return; }
  if (steps[f.step].key === 'mood' && !f.draft.mood) { toast('Choose a number from 1 to 5 first.'); return; }
  if (f.step < steps.length - 1) { f.step++; f.dir = 'next'; sound('tap'); renderFlow(true); return; }
  try { submitReflection(state, f.mode, f.draft); } catch (error) { toast(error.message); return; }
  const mode = f.mode;
  closeFlow();
  render();
  sound('complete');
  milestone(mode, mode === 'morning' ? 'Morning check-in' : 'Evening reflection', mode === 'morning' ? 'A good place to start the day.' : 'Tomorrow is a new page.');
  if (state.morning && state.evening) setTimeout(() => milestone('both', 'Both bookends', 'A full day, in your own words.'), 1600);
}

/* Quiet pop-ups */
function toast(text) {
  const el = document.querySelector('#toast');
  el.innerHTML = `${icon('check')}<span>${esc(text)}</span>`;
  el.hidden = false;
  el.classList.remove('toast');
  void el.offsetWidth;
  el.classList.add('toast');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function milestone(id, label, text) {
  if (ui.shown.has(id)) return;
  ui.shown.add(id);
  const el = document.createElement('div');
  el.className = 'milestone';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="milestone-icon" aria-hidden="true">${icon('sparkle')}</span><div><span class="label">${esc(label)}</span><p>${esc(text)}</p></div>`;
  el.style.setProperty('--stack', document.querySelectorAll('.milestone').length);
  document.body.append(el);
  setTimeout(() => el.remove(), 4600);
}

/* Water: pour, slosh, splash, and the sound of it */
function addWater(amount, button) {
  const before = state.water;
  changeWater(state, amount);
  if (state.water === before) {
    replay(button, 'fx-nope', 420);
    if (amount > 0) toast('That’s plenty for today.');
    return;
  }
  const up = state.water > before;
  const vessel = root.querySelector('[data-vessel]');
  // Start the pour before the new level is applied, so the rise waits for the stream to land.
  if (up) { replay(vessel, 'fx-pouring', 1200); replay(vessel, 'fx-slosh', 1700); }
  else replay(vessel, 'fx-slosh-soft', 1300);
  render();
  roll(root.querySelector('[data-roll="glasses"]'), before, state.water, up);
  roll(root.querySelector('[data-roll="litres"]'), litres(before), litres(state.water), up);
  if (up) {
    sound('pour', {level: waterLevel(state.water)});
    replay(root.querySelector(`.pip[data-i="${state.water - 1}"]`), 'fx-pop', 700);
    if (state.water >= WATER_GOAL && before < WATER_GOAL) {
      setTimeout(() => { sound('complete'); replay(root.querySelector('[data-vessel]'), 'fx-goal', 1800); milestone('water', 'Water', `${WATER_GOAL} glasses today. Well done.`); }, 900);
    }
  } else sound('sip');
}

/* Chart tooltips (delegated, so they survive re-renders) and a soft light that follows the pointer */
function showTip(wrap, point) {
  if (!wrap || !point) return;
  let tip = wrap.querySelector('.chart-tip');
  if (wrap._point === point && tip) return;
  wrap._point = point;
  wrap.querySelectorAll('.point.fx-on').forEach(p => p.classList.remove('fx-on'));
  point.classList.add('fx-on');
  const guide = wrap.querySelector('.guide');
  guide?.setAttribute('x1', point.getAttribute('cx'));
  guide?.setAttribute('x2', point.getAttribute('cx'));
  guide?.classList.add('fx-on');
  if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; wrap.append(tip); }
  tip.innerHTML = `<b>${esc(point.dataset.day)}</b><span>${esc(point.dataset.mood)}</span>`;
  const r = point.getBoundingClientRect(), w = wrap.getBoundingClientRect(), half = tip.offsetWidth / 2;
  tip.style.left = `${Math.max(half, Math.min(w.width - half, r.left - w.left + r.width / 2))}px`;
  tip.style.top = `${r.top - w.top}px`;
}
function hideTip(wrap) {
  if (!wrap) return;
  wrap._point = null;
  wrap.querySelector('.chart-tip')?.remove();
  wrap.querySelectorAll('.fx-on').forEach(el => el.classList.remove('fx-on'));
}
function nearestPoint(wrap, x) {
  let best, gap = Infinity;
  for (const p of wrap.querySelectorAll('.point')) {
    const r = p.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x);
    if (d < gap) { gap = d; best = p; }
  }
  return best;
}
root.addEventListener('pointermove', event => {
  const wrap = event.target.closest?.('.chart-wrap');
  root.querySelectorAll('.chart-wrap').forEach(w => { if (w !== wrap) hideTip(w); });
  if (wrap) showTip(wrap, nearestPoint(wrap, event.clientX));
  if (!finePointer || reduced) return;
  const tile = event.target.closest?.('.tile');
  if (tile) {
    const r = tile.getBoundingClientRect();
    tile.style.setProperty('--mx', `${Math.round(event.clientX - r.left)}px`);
    tile.style.setProperty('--my', `${Math.round(event.clientY - r.top)}px`);
  }
});
root.addEventListener('pointerleave', () => root.querySelectorAll('.chart-wrap').forEach(hideTip));
root.addEventListener('focusin', event => { if (event.target.matches?.('.point')) showTip(event.target.closest('.chart-wrap'), event.target); });
root.addEventListener('focusout', event => { if (event.target.matches?.('.point')) hideTip(event.target.closest('.chart-wrap')); });

/* Theme: the new look spreads out in a circle from the button you pressed */
function switchTheme(from) {
  const apply = () => { ui.theme = ui.theme === 'night' ? 'day' : 'night'; render(); };
  sound('toggle');
  if (reduced || !document.startViewTransition || !from) { apply(); return; }
  const r = from.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(apply);
  transition.ready.then(() => document.documentElement.animate(
    {clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]},
    {duration: 650, easing: 'cubic-bezier(.22,.8,.2,1)', pseudoElement: '::view-transition-new(root)'}
  )).catch(() => {});
}

/* Events */
root.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    if (ui.view === viewButton.dataset.view) return;
    ui.view = viewButton.dataset.view;
    sound('tap');
    render({focus: true});
    scrollTo({top: 0});
    return;
  }
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'flow') startFlow(btn.dataset.mode);
  else if (action === 'mood') {
    const mood = Number(btn.dataset.mood);
    if (ui.quickMood === mood && !state.morning && !state.evening) return;
    ui.quickMood = mood;
    sound('tap');
    render();
    if (state.morning || state.evening) toast('Your check-in mood stays on the chart. This one is noted too.');
  } else if (action === 'habit') {
    toggleHabit(state, btn.dataset.id);
    const done = state.habits.find(h => h.id === Number(btn.dataset.id))?.done;
    sound(done ? 'done' : 'undo');
    render();
    if (done && habitsDone() === state.habits.length) { setTimeout(() => sound('complete'), 250); milestone('habits', 'Habits', 'Every small step, done today.'); }
  } else if (action === 'add-habit') {
    const input = root.querySelector('#new-habit');
    if (addHabit(state, input.value)) { input.value = ''; sound('done'); render(); toast('Habit added.'); input.focus(); }
    else { replay(input.closest('.habit-add'), 'fx-nope', 420); toast(state.habits.length >= 8 ? 'Up to eight habits in the preview.' : 'Try a new habit name.'); }
  } else if (action === 'water') addWater(Number(btn.dataset.amount), btn);
  else if (action === 'period') { const p = Number(btn.dataset.period); if (p !== ui.period) { ui.period = p; sound('tap'); render(); } }
  else if (action === 'sound') { ui.sound = !ui.sound; render(); sound('toggle'); toast(ui.sound ? 'Sounds on.' : 'Sounds off.'); }
  else if (action === 'theme') switchTheme(btn);
  else if (action === 'save-name') { state.name = root.querySelector('#pref-name').value.trim().slice(0, 40); sound('done'); render(); toast(state.name ? `Nice to meet you, ${state.name}.` : 'Name cleared.'); }
  else if (action === 'save-note') { state.weeklyNote = root.querySelector('#weekly-note').value.slice(0, 1200); sound('done'); toast('Note kept for this session.'); }
  else if (action === 'reset') document.querySelector('#reset-dialog').showModal();
});
root.addEventListener('change', event => { if (event.target.matches('[data-action="style"]')) { state.reflectionStyle = event.target.value; toast(`Reflections: ${state.reflectionStyle}.`); } });
root.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.id === 'new-habit') { event.preventDefault(); root.querySelector('[data-action="add-habit"]').click(); } });
document.addEventListener('click', event => { const b = event.target.closest('[data-flow]'); if (b && ui.flow) flowAction(b.dataset.flow, b); });
document.addEventListener('keydown', event => {
  if (!ui.flow) return;
  if (event.key === 'Escape') flowAction('close');
  else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) flowAction('next');
});
document.querySelector('#confirm-reset').addEventListener('click', () => {
  state = createState();
  ui = {...freshUi(), sound: ui.sound};
  document.querySelector('#reset-dialog').close();
  root.replaceChildren();
  render({focus: true});
  toast('A fresh page.');
});
document.querySelector('#cancel-reset').addEventListener('click', () => document.querySelector('#reset-dialog').close());
document.querySelector('#accept-preview').addEventListener('click', () => { document.querySelector('#app-notice').close(); state.onboarded = true; sound('done'); });
addEventListener('pageshow', event => { if (event.persisted) { state = createState(); ui = freshUi(); root.replaceChildren(); render(); } });

render();
document.querySelector('#app-notice').showModal();
