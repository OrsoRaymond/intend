// Intend app preview: a dimensional daily dashboard with reflections, habits, water, mood tracking,
// pop-ups, achievements and soft generated sounds. Everything lives in page memory only (see state.js).
import {createState, MOODS, SAMPLE_WEEK, escapeHTML as esc, addHabit, toggleHabit, changeWater, submitReflection} from './state.js';

const FACES = ['☹', '⌢', '–', '◡', '☺'];
const WATER_GOAL = 8;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createState();
let ui = freshUi();
let toastTimer;
const root = document.querySelector('#app');

function freshUi() {
  return {view: 'today', sound: true, theme: 'day', period: 7, flow: null, quickMood: 0, earned: new Set(), lastFocus: null};
}

/* ───────────── icons ───────────── */
const paths = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  journal: '<path d="M5 3h13a1 1 0 0 1 1 1v17H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 14h14M8 7h7M8 10h5"/>',
  patterns: '<path d="M3 3v17h18M6 15l4-5 4 2 6-7"/>',
  recipe: '<path d="M12 21V8m0 7C4 15 3 10 3 7c6 0 9 2 9 8Zm0-4c0-5 3-8 9-8 0 6-4 8-9 8Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 1 3h4l1-3 3-1 3-2-1-3 1-3-3-2-1-3Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const VIEWS = [['today', 'Today'], ['journal', 'Journal'], ['patterns', 'Patterns'], ['recipe', 'My recipe'], ['settings', 'My space']];

/* ───────────── sound (Web Audio, generated) ───────────── */
let audio;
function sound(kind) {
  if (!ui.sound || reduced) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const tone = (freq, start, len, type = 'sine', vol = .08, to) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t + start);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + start + len);
      g.gain.setValueAtTime(.0001, t + start); g.gain.exponentialRampToValueAtTime(vol, t + start + .015);
      g.gain.exponentialRampToValueAtTime(.0001, t + start + len);
      o.connect(g).connect(audio.destination); o.start(t + start); o.stop(t + start + len + .05);
    };
    if (kind === 'pop') { tone(520, 0, .14, 'sine', .09, 940); tone(1320, .04, .1, 'triangle', .03); }
    else if (kind === 'undo') tone(700, 0, .14, 'sine', .06, 380);
    else if (kind === 'tick') tone(880, 0, .06, 'triangle', .04);
    else if (kind === 'water') { tone(900, 0, .22, 'sine', .08, 260); tone(1400, .06, .12, 'sine', .03, 600); }
    else if (kind === 'chime') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * .09, .5, 'sine', .07));
    else if (kind === 'open') tone(320, 0, .25, 'sine', .05, 640);
  } catch { /* sound is a nicety */ }
}

/* ───────────── helpers ───────────── */
const dateLabel = () => new Intl.DateTimeFormat(undefined, {weekday: 'long', month: 'long', day: 'numeric'}).format(new Date());
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  return state.name ? `${part}, ${esc(state.name)}.` : `${part}.`;
}
const habitsDone = () => state.habits.filter(h => h.done).length;
function progress() {
  const parts = [state.morning ? 1 : 0, state.evening ? 1 : 0, state.habits.length ? habitsDone() / state.habits.length : 0, Math.min(1, state.water / WATER_GOAL)];
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
}
const todayMood = () => state.evening?.mood || state.morning?.mood || ui.quickMood || 0;
function applyVars(scope = document) {
  scope.querySelectorAll('[data-h]').forEach(el => el.style.setProperty('--h', `${Math.max(4, Math.min(100, Number(el.dataset.h) || 0))}%`));
  scope.querySelectorAll('[data-fill]').forEach(el => el.style.setProperty('--fill', `${Math.max(0, Math.min(100, Number(el.dataset.fill) || 0))}%`));
}

/* ───────────── shell ───────────── */
function shell() {
  const navButtons = VIEWS.map(([key, label]) => `<button data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${label}</span>${key === 'today' && !state.morning ? '<span class="nav-badge" aria-label="Check-in waiting">1</span>' : ''}</button>`).join('');
  root.innerHTML = `
  <div class="app-shell">
    <aside class="app-sidebar">
      <a href="/" class="wordmark" aria-label="Intend website"><span class="sun-mark" aria-hidden="true">✳</span>intend.</a>
      <p class="sidebar-caption">Your daily space</p>
      <nav class="app-nav" aria-label="App">${navButtons}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-card"><span aria-hidden="true">✳</span><h2>Your pace. Your space.</h2><button class="text-link" data-view="settings">Make it yours ↗</button></div>
        <div class="sidebar-links"><a href="/">← Website</a><a href="/privacy/" target="_blank" rel="noopener">Privacy</a><a href="/terms/" target="_blank" rel="noopener">Terms</a></div>
        <a class="sidebar-credit" href="https://otoro.si" target="_blank" rel="noopener noreferrer"><b aria-hidden="true">⛨</b><span>Built &amp; secured with Orso Solutions × OTORO</span></a>
      </div>
    </aside>
    <main class="app-main" id="app-content" tabindex="-1"></main>
  </div>
  <nav class="mobile-tabs" aria-label="App">${VIEWS.map(([key, label]) => `<button data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${label.replace('My ', '')}</span></button>`).join('')}</nav>`;
}

function topBar(title, subtitle) {
  return `<header class="app-top"><div class="app-heading"><p class="app-date">${dateLabel()}</p><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div>
  <div class="top-actions">
    <button class="icon-button" data-action="sound" aria-pressed="${ui.sound}" aria-label="${ui.sound ? 'Sounds on' : 'Sounds off'}">${ui.sound ? '♪' : '♩'}</button>
    <button class="icon-button" data-action="theme" aria-pressed="${ui.theme === 'night'}" aria-label="Switch to ${ui.theme === 'night' ? 'day' : 'night'} look">${ui.theme === 'night' ? '☾' : '☼'}</button>
    <button class="avatar" data-view="settings" aria-label="My space">${esc((state.name || 'You').slice(0, 1).toUpperCase())}</button>
  </div></header>`;
}

function render(focus = false) {
  document.body.dataset.theme = ui.theme;
  shell();
  const main = root.querySelector('#app-content');
  main.innerHTML = ({today, journal, patterns, recipe, settings})[ui.view]();
  applyVars(main);
  if (ui.view === 'patterns' || ui.view === 'today') wireChart(main);
  if (focus) main.querySelector('h1')?.focus();
  if (ui.flow) renderFlow();
}

/* ───────────── today ───────────── */
function ring(pct) {
  const c = 2 * Math.PI * 50;
  return `<div class="ring-meter"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ring-gradient" x1="0" x2="1"><stop offset="0" stop-color="#e2a54a"/><stop offset="1" stop-color="#c8714a"/></linearGradient></defs>
    <circle class="track" cx="60" cy="60" r="50"/><circle class="fill" cx="60" cy="60" r="50" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg><strong>${pct}%</strong></div>`;
}

function chartSvg(values, labels, id) {
  const w = 620, h = 220, pad = 34, max = 5;
  const step = (w - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const every = values.length > 10 ? 5 : 1;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mood over ${values.length} days, out of five" data-chart="${id}">
    <defs><linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e2a54a" stop-opacity=".45"/><stop offset="1" stop-color="#e2a54a" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${[1, 2, 3, 4, 5].map(v => `<line x1="${pad}" x2="${w - pad}" y1="${h - pad - v / max * (h - pad * 2)}" y2="${h - pad - v / max * (h - pad * 2)}"/>`).join('')}</g>
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    ${pts.map((p, i) => `<circle class="point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="6" tabindex="0" data-tip="${esc(labels[i])}: ${MOODS[Math.round(values[i]) - 1] || 'Steady'}"/>`).join('')}
    ${labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? `<text x="${pts[i][0].toFixed(1)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>` : '').join('')}
  </svg>`;
}

function weekValues() {
  const values = SAMPLE_WEEK.slice(0, 6);
  values.push(todayMood() || SAMPLE_WEEK[6]);
  const days = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(new Date(Date.now() - (6 - i) * 864e5)));
  days[6] = 'Today';
  return {values, days};
}

function today() {
  const evening = new Date().getHours() >= 17;
  const mode = state.morning && !state.evening ? 'evening' : !state.morning ? 'morning' : null;
  const cta = mode ? `<button class="button light" data-action="flow" data-mode="${mode}">${mode === 'morning' ? 'Start my morning check-in' : 'Start my evening reflection'} <span aria-hidden="true">↗</span></button>` : '<p class="pill">Both bookends done today ✓</p>';
  const intention = state.morning?.intention ? `“${esc(state.morning.intention)}”` : evening ? 'How did today feel? A few minutes is plenty.' : 'Make room for something good.';
  const pct = progress();
  const {values, days} = weekValues();
  return `${topBar(greeting(), 'Your space to check in, reflect and notice what makes a good day.')}
  <div class="dash">
    <section class="tile hero-tile span-8" aria-labelledby="today-intent">
      <div><p class="eyebrow">${state.morning ? 'Today’s intention' : 'Your morning'}</p><h2 id="today-intent">${intention}</h2>
        <p>${state.morning ? `Feeling ${MOODS[state.morning.mood - 1].toLowerCase()} this morning.` : 'Two minutes to decide how you want to show up.'}</p>${cta}</div>
      <div class="day-orb" aria-hidden="true"><span class="ring"></span><span class="ring two"></span><span class="core"></span></div>
    </section>
    <section class="tile span-4 stat-tile" aria-labelledby="progress-title">${ring(pct)}
      <div><p class="eyebrow">Today</p><h2 id="progress-title">${pct >= 100 ? 'A full day.' : pct >= 50 ? 'Nice rhythm.' : 'Just getting started.'}</h2><p>${(state.morning ? 1 : 0) + (state.evening ? 1 : 0)} of 2 check-ins · ${habitsDone()} of ${state.habits.length} habits · ${state.water} of ${WATER_GOAL} glasses</p></div>
    </section>
    <section class="tile span-12" aria-labelledby="mood-title">
      <div class="tile-head"><div><p class="eyebrow">Quick check</p><h2 id="mood-title">How are you, right now?</h2></div>${todayMood() ? `<span class="pill">${MOODS[todayMood() - 1]}</span>` : ''}</div>
      <div class="mood-row" role="group" aria-label="Choose your mood">${MOODS.map((m, i) => `<button class="mood-button" data-action="mood" data-mood="${i + 1}" aria-pressed="${todayMood() === i + 1}"><span aria-hidden="true">${FACES[i]}</span>${m}</button>`).join('')}</div>
    </section>
    <section class="tile span-6" aria-labelledby="habits-title">
      <div class="tile-head"><div><p class="eyebrow">Little habits</p><h2 id="habits-title">Small steps, ticked.</h2></div><span class="pill">${habitsDone()}/${state.habits.length}</span></div>
      <div class="habit-list">${state.habits.map(h => `<div class="habit-row"><button class="habit" data-action="habit" data-id="${h.id}" aria-pressed="${h.done}"><span class="check" aria-hidden="true">✓</span><span class="habit-name">${esc(h.name)}</span></button></div>`).join('')}</div>
      <div class="add-habit"><label class="sr-only" for="new-habit">New habit</label><input id="new-habit" maxlength="60" placeholder="Add a habit, like ‘Stretch’"><button class="small-button" data-action="add-habit">Add</button></div>
    </section>
    <section class="tile span-6" aria-labelledby="water-title">
      <div class="tile-head"><div><p class="eyebrow">Water</p><h2 id="water-title">${state.water >= WATER_GOAL ? 'Fully topped up.' : 'A glass at a time.'}</h2></div><span class="pill">Goal ${WATER_GOAL}</span></div>
      <div class="glass-wrap"><div class="glass" aria-hidden="true"><span class="water" data-fill="${Math.min(100, state.water / WATER_GOAL * 100)}"></span></div>
        <div class="water-controls"><p class="water-count">${state.water}<small> glasses</small></p>
          <div class="add-habit"><button class="small-button" data-action="water" data-amount="1">+ Glass</button><button class="small-button soft" data-action="water" data-amount="-1" aria-label="Remove a glass">−</button></div></div></div>
    </section>
    <section class="tile span-8" aria-labelledby="week-title">
      <div class="tile-head"><div><p class="eyebrow">This week · sample + today</p><h2 id="week-title">Your mood, at a glance.</h2></div><button class="small-button soft" data-view="patterns">See patterns</button></div>
      <div class="chart-wrap">${chartSvg(values, days, 'week')}</div>
    </section>
    <section class="tile span-4" aria-labelledby="evening-title">
      <p class="eyebrow">${state.evening ? 'Word of the day' : 'Tonight'}</p>
      <h2 id="evening-title">${state.evening?.word ? esc(state.evening.word) : 'What’s staying with you?'}</h2>
      <p>${state.evening ? 'Tomorrow is a new page.' : 'The good bits, the hard bits, and one word to remember the day by.'}</p>
      ${state.morning && !state.evening ? '<p><button class="small-button" data-action="flow" data-mode="evening">Reflect now</button></p>' : ''}
    </section>
  </div>`;
}

/* ───────────── journal ───────────── */
function entryCard(mode) {
  const e = state[mode];
  if (!e) return '';
  const labels = mode === 'morning'
    ? [['intention', 'Intention'], ['gratitude', 'Grateful for'], ['great', 'Would make today great'], ['mustDo', 'Must do']]
    : [['body', 'Body'], ['mind', 'Mind'], ['good', 'Good things'], ['word', 'Word of the day'], ['promise', 'For tomorrow']];
  return `<article class="entry tile"><div class="tile-head"><h3>${mode === 'morning' ? '☼ Morning check-in' : '☾ Evening reflection'}</h3><span class="pill">${FACES[e.mood - 1]} ${MOODS[e.mood - 1]}</span></div>
    <dl>${labels.filter(([k]) => e[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(e[k])}</dd>`).join('') || '<dt>Mood</dt><dd>Just the check-in today.</dd>'}</dl>
    <p><button class="small-button soft" data-action="flow" data-mode="${mode}">Edit</button></p></article>`;
}
function journal() {
  const any = state.morning || state.evening;
  return `${topBar('Journal', 'Today’s pages. They stay in this open page only.')}
  <div class="dash"><div class="span-7 settings-list">${any ? entryCard('morning') + entryCard('evening') : `<div class="tile empty"><div class="notice-icon" aria-hidden="true">✎</div><h2>A fresh page.</h2><p>Start with a two-minute morning check-in.</p><button class="button" data-action="flow" data-mode="morning">Begin <span aria-hidden="true">↗</span></button></div>`}</div>
  <section class="tile span-5" aria-labelledby="weekly-title"><p class="eyebrow">Weekly note</p><h2 id="weekly-title">A note to your week.</h2><label class="sr-only" for="weekly-note">Weekly note</label><textarea id="weekly-note" maxlength="1200" placeholder="What do you want to remember about this week?">${esc(state.weeklyNote)}</textarea><p><button class="small-button" data-action="save-note">Keep note</button></p></section></div>`;
}

/* ───────────── patterns ───────────── */
function series(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(Math.max(1.4, Math.min(5, 3.3 + Math.sin(i * .9) * .9 + Math.cos(i * .37) * .5 + (i % 7 === 3 ? .6 : 0))));
  return out.map(v => Math.round(v * 10) / 10);
}
function patterns() {
  const n = ui.period;
  const values = series(n);
  const labels = values.map((_, i) => n === 7 ? new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(new Date(Date.now() - (n - 1 - i) * 864e5)) : `Day ${i + 1}`);
  const avg = (values.reduce((a, b) => a + b, 0) / n).toFixed(1);
  const best = Math.max(...values).toFixed(1);
  return `${topBar('Patterns', 'Illustrative sample data. Associations, never diagnoses.')}
  <div class="dash">
    <section class="tile span-8" aria-labelledby="trend-title"><div class="tile-head"><div><p class="eyebrow">Sample trend</p><h2 id="trend-title">Mood over ${n} days</h2></div>
      <div class="segmented" role="group" aria-label="Period">${[7, 30].map(p => `<button data-action="period" data-period="${p}" aria-pressed="${n === p}">${p} days</button>`).join('')}</div></div>
      <div class="chart-wrap">${chartSvg(values, labels, 'trend')}</div></section>
    <section class="tile span-4 stat-tile"><div><p class="eyebrow">Average</p><p class="num">${avg}</p><p>out of 5 · best day ${best}</p></div></section>
    <section class="tile span-4"><p class="eyebrow">What lifts you</p><h2>Fresh air.</h2><p>In this sample, days with a walk scored higher.</p><div class="week">${[62, 70, 96, 74, 92, 66, 98].map(h => `<div class="week-bar"><i data-h="${h}"></i></div>`).join('')}</div></section>
    <section class="tile span-4"><p class="eyebrow">Sleep and mood</p><h2>Early nights help.</h2><p>Sample nights over 7 hours sit next to steadier mornings.</p></section>
    <section class="tile span-4"><p class="eyebrow">People</p><h2>Conversations count.</h2><p>Sample days with a real conversation felt warmer.</p></section>
  </div>`;
}

/* ───────────── recipe ───────────── */
function recipe() {
  return `${topBar('My recipe', 'A sample 30-day “recipe” for your good days. Real personal recipes come later.')}
  <div class="dash"><section class="tile span-12 hero-tile"><div><p class="eyebrow">Your good-day recipe · sample</p><h2>A walk, a good talk, and an early night.</h2><p>Built from 30 days of example reflections.</p></div><div class="day-orb" aria-hidden="true"><span class="ring"></span><span class="core"></span></div></section>
  <section class="tile span-12"><div class="recipe-grid">
    <div class="ingredient tilt"><strong>4×</strong><p>more good days with time outside</p></div>
    <div class="ingredient tilt"><strong>7h+</strong><p>of sleep before your best mornings</p></div>
    <div class="ingredient tilt"><strong>2</strong><p>real conversations a week, at least</p></div>
  </div></section></div>`;
}

/* ───────────── settings ───────────── */
function settings() {
  const sw = (action, on, label) => `<button class="switch" role="switch" aria-checked="${on}" data-action="${action}" aria-label="${label}"></button>`;
  return `${topBar('My space', 'Make it feel like yours. Preferences stay in this open page only.')}
  <div class="dash"><div class="span-7 settings-list">
    <div class="setting"><div><b>Your name</b><span>For a friendlier hello.</span></div><div class="add-habit"><label class="sr-only" for="pref-name">Your name</label><input id="pref-name" maxlength="40" value="${esc(state.name)}" placeholder="Name or nickname"><button class="small-button" data-action="save-name">Save</button></div></div>
    <div class="setting"><div><b>Reflections</b><span>Which bookends you want.</span></div><label class="sr-only" for="pref-style">Reflection style</label><select id="pref-style" data-action="style">${['Both', 'Morning only', 'Evening only'].map(o => `<option ${state.reflectionStyle === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
    <div class="setting"><div><b>Sounds</b><span>Soft pops and chimes.</span></div>${sw('sound', ui.sound, 'Sounds')}</div>
    <div class="setting"><div><b>Night look</b><span>Warm and dark for evenings.</span></div>${sw('theme', ui.theme === 'night', 'Night look')}</div>
    <div class="setting"><div><b>Reminders</b><span>Morning ${esc(state.reminderMorning)} · evening ${esc(state.reminderEvening)} (planned for the apps)</span></div></div>
    <div class="setting"><div><b>Start fresh</b><span>Clear everything in this preview.</span></div><button class="small-button soft" data-action="reset">Clear</button></div>
  </div>
  <section class="tile span-5 hero-tile"><div><p class="eyebrow">Built &amp; secured with</p><h2>Orso Solutions × OTORO</h2><p>No trackers, no third-party calls, nothing saved. Privacy by design.</p><a class="button light" href="https://otoro.si" target="_blank" rel="noopener noreferrer">Meet OTORO <span aria-hidden="true">↗</span></a></div></section></div>`;
}

/* ───────────── reflection flow (one question per screen) ───────────── */
const STEPS = {
  morning: [
    {key: 'mood', q: 'How’s your headspace this morning?'},
    {key: 'intention', q: 'How do you want to show up today?', ph: 'Be here for the small things.'},
    {key: 'gratitude', q: 'One thing you’re grateful for?', ph: 'Coffee that’s still warm.'},
    {key: 'great', q: 'What would make today great?', ph: 'A walk before lunch.'},
    {key: 'mustDo', q: 'One thing that has to get done?', ph: 'Call the dentist.'}
  ],
  evening: [
    {key: 'mood', q: 'How are you feeling tonight?'},
    {key: 'body', q: 'How does your body feel?', ph: 'Tired legs, good tired.'},
    {key: 'mind', q: 'What’s on your mind?', ph: 'Tomorrow’s meeting.'},
    {key: 'good', q: 'Three good things from today?', ph: 'Sun on the walk, a kind text, dinner.'},
    {key: 'word', q: 'One word for today?', ph: 'Grounded'},
    {key: 'promise', q: 'A small promise for tomorrow?', ph: 'Phone stays out of the bedroom.'}
  ]
};
function startFlow(mode) {
  const prev = state[mode];
  ui.flow = {mode, step: 0, draft: prev ? {...prev} : {}};
  ui.lastFocus = document.activeElement;
  sound('open');
  renderFlow();
}
function renderFlow() {
  document.querySelector('.flow')?.remove();
  const f = ui.flow; if (!f) return;
  const steps = STEPS[f.mode], s = steps[f.step], last = f.step === steps.length - 1;
  const body = s.key === 'mood'
    ? `<div class="mood-row" role="group" aria-label="Mood">${MOODS.map((m, i) => `<button class="mood-button" data-flow="mood" data-mood="${i + 1}" aria-pressed="${f.draft.mood === i + 1}"><span aria-hidden="true">${FACES[i]}</span>${m}</button>`).join('')}</div>`
    : `<label class="sr-only" for="flow-input">${s.q}</label><textarea id="flow-input" maxlength="1200" placeholder="${esc(s.ph)}">${esc(f.draft[s.key] || '')}</textarea>`;
  const el = document.createElement('div');
  el.className = 'flow';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'flow-q');
  el.innerHTML = `<div class="flow-card"><div class="flow-progress" aria-hidden="true">${steps.map((_, i) => `<i class="${i <= f.step ? 'on' : ''}"></i>`).join('')}</div>
    <p class="eyebrow">${f.mode === 'morning' ? '☼ Morning check-in' : '☾ Evening reflection'} · ${f.step + 1} of ${steps.length}</p>
    <h2 id="flow-q">${s.q}</h2>${body}
    <div class="flow-actions"><button class="plain-button" data-flow="${f.step ? 'back' : 'close'}">${f.step ? '← Back' : 'Not now'}</button>
    <span>${s.key !== 'mood' && !last ? '<button class="plain-button" data-flow="skip">Skip</button> ' : ''}<button class="button" data-flow="next">${last ? 'Finish' : 'Next'} <span aria-hidden="true">↗</span></button></span></div></div>`;
  document.body.append(el);
  (el.querySelector('textarea') || el.querySelector('.mood-button[aria-pressed="true"]') || el.querySelector('.mood-button'))?.focus();
}
function keepDraft() {
  const f = ui.flow, s = STEPS[f.mode][f.step];
  const input = document.querySelector('#flow-input');
  if (input) f.draft[s.key] = input.value;
}
function flowAction(action, target) {
  const f = ui.flow; if (!f) return;
  const steps = STEPS[f.mode];
  if (action === 'mood') { f.draft.mood = Number(target.dataset.mood); sound('tick'); renderFlow(); return; }
  if (action === 'close') { ui.flow = null; document.querySelector('.flow')?.remove(); ui.lastFocus?.focus?.(); return; }
  keepDraft();
  if (action === 'back') { f.step--; renderFlow(); return; }
  if (steps[f.step].key === 'mood' && !f.draft.mood) { toast('Pick how you feel first.', '☺'); return; }
  if (f.step < steps.length - 1) { f.step++; sound('tick'); renderFlow(); return; }
  try { submitReflection(state, f.mode, f.draft); } catch (error) { toast(error.message, '!'); return; }
  const mode = f.mode;
  ui.flow = null;
  document.querySelector('.flow')?.remove();
  render();
  sound('chime'); confetti();
  achieve(mode === 'morning' ? 'morning' : 'evening', mode === 'morning' ? 'Morning check-in done' : 'Evening reflection done', mode === 'morning' ? 'A good place to start.' : 'Tomorrow is a new page.', mode === 'morning' ? '☼' : '☾');
  if (state.morning && state.evening) setTimeout(() => achieve('both', 'Both bookends today', 'A full day, in your words.', '✳'), 1400);
}

/* ───────────── pop-ups ───────────── */
function toast(text, mark = '✓') {
  const el = document.querySelector('#toast');
  el.innerHTML = `<b aria-hidden="true">${esc(mark)}</b><span>${esc(text)}</span>`;
  el.hidden = false;
  el.classList.remove('toast'); void el.offsetWidth; el.classList.add('toast');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function achieve(id, title, note, mark) {
  if (ui.earned.has(id)) return;
  ui.earned.add(id);
  const el = document.createElement('div');
  el.className = 'achievement'; el.setAttribute('role', 'status');
  el.innerHTML = `<b aria-hidden="true">${mark}</b><div>${esc(title)}<small>${esc(note)}</small></div>`;
  document.body.append(el);
  setTimeout(() => el.remove(), 4300);
}
function confetti() {
  if (reduced) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti'; canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d'), colors = ['#e2a54a', '#c8714a', '#8f9d72', '#b9844f', '#f6dcae', '#6a4a33'];
  const parts = [...Array(140)].map(() => ({x: canvas.width / 2, y: canvas.height * .35, vx: (Math.random() - .5) * 26, vy: -Math.random() * 22 - 6, s: (Math.random() * 7 + 5) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: colors[Math.random() * colors.length | 0]}));
  let frame = 0;
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of parts) { p.vy += .6; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
    if (++frame < 140) requestAnimationFrame(tick); else canvas.remove();
  })();
}

/* ───────────── chart tooltips + tilt ───────────── */
function wireChart(scope) {
  scope.querySelectorAll('.chart .point').forEach(point => {
    const show = () => {
      scope.querySelector('.chart-tip')?.remove();
      const wrap = point.closest('.tile'), r = point.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      const tip = document.createElement('div');
      tip.className = 'chart-tip'; tip.textContent = point.dataset.tip;
      tip.style.left = `${r.left - w.left + r.width / 2}px`; tip.style.top = `${r.top - w.top}px`;
      wrap.append(tip); sound('tick');
    };
    point.addEventListener('pointerenter', show); point.addEventListener('focus', show);
    point.addEventListener('pointerleave', () => scope.querySelector('.chart-tip')?.remove());
    point.addEventListener('blur', () => scope.querySelector('.chart-tip')?.remove());
  });
  if (reduced || !matchMedia('(pointer: fine)').matches) return;
  scope.querySelectorAll('.tile, .tilt').forEach(card => {
    card.classList.add('tilt');
    card.addEventListener('pointermove', event => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${(((event.clientX - r.left) / r.width - .5) * 5).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-((event.clientY - r.top) / r.height - .5) * 5).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

/* ───────────── events ───────────── */
root.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { ui.view = viewButton.dataset.view; sound('tick'); render(true); scrollTo(0, 0); return; }
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'flow') startFlow(btn.dataset.mode);
  else if (action === 'mood') { ui.quickMood = Number(btn.dataset.mood); sound('pop'); render(); toast(`Noted: ${MOODS[ui.quickMood - 1]}.`, FACES[ui.quickMood - 1]); }
  else if (action === 'habit') {
    toggleHabit(state, btn.dataset.id);
    const done = state.habits.find(h => h.id === Number(btn.dataset.id))?.done;
    sound(done ? 'pop' : 'undo'); render();
    if (done) achieve('first-habit', 'First habit ticked', 'Small steps count.', '✓');
    if (state.habits.length && habitsDone() === state.habits.length) { confetti(); sound('chime'); achieve('all-habits', 'Every habit, done', 'Look at you go.', '★'); }
  } else if (action === 'add-habit') {
    const input = root.querySelector('#new-habit');
    if (addHabit(state, input.value)) { sound('pop'); render(); toast('Habit added.'); root.querySelector('#new-habit')?.focus(); }
    else toast(state.habits.length >= 8 ? 'Up to 8 habits in the preview.' : 'Try a new, non-empty habit name.', '!');
  } else if (action === 'water') {
    const before = state.water;
    changeWater(state, Number(btn.dataset.amount));
    if (state.water !== before) { sound(state.water > before ? 'water' : 'undo'); render(); }
    if (state.water >= WATER_GOAL && before < WATER_GOAL) { confetti(); achieve('water', 'Hydrated', `${WATER_GOAL} glasses today.`, '💧'); }
  } else if (action === 'period') { ui.period = Number(btn.dataset.period); sound('tick'); render(); }
  else if (action === 'sound') { ui.sound = !ui.sound; render(); sound('pop'); toast(ui.sound ? 'Sounds on.' : 'Sounds off.', ui.sound ? '♪' : '♩'); }
  else if (action === 'theme') { ui.theme = ui.theme === 'night' ? 'day' : 'night'; sound('open'); render(); }
  else if (action === 'save-name') { state.name = root.querySelector('#pref-name').value.trim().slice(0, 40); sound('pop'); render(); toast(state.name ? `Nice to meet you, ${state.name}.` : 'Name cleared.'); }
  else if (action === 'save-note') { state.weeklyNote = root.querySelector('#weekly-note').value.slice(0, 1200); sound('pop'); toast('Note kept for this session.'); }
  else if (action === 'reset') document.querySelector('#reset-dialog').showModal();
});
root.addEventListener('change', event => {
  if (event.target.matches('[data-action="style"]')) { state.reflectionStyle = event.target.value; sound('tick'); toast(`Reflections: ${state.reflectionStyle}.`); }
});
root.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.id === 'new-habit') root.querySelector('[data-action="add-habit"]').click();
});
document.addEventListener('click', event => {
  const flowBtn = event.target.closest('[data-flow]');
  if (flowBtn) flowAction(flowBtn.dataset.flow, flowBtn);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && ui.flow) flowAction('close');
});
document.querySelector('#confirm-reset').addEventListener('click', () => {
  state = createState(); ui = {...freshUi(), sound: ui.sound};
  document.querySelector('#reset-dialog').close(); sound('open'); render(true); toast('A fresh page.', '↺');
});
document.querySelector('#cancel-reset').addEventListener('click', () => document.querySelector('#reset-dialog').close());
document.querySelector('#accept-preview').addEventListener('click', () => {
  document.querySelector('#app-notice').close(); state.onboarded = true; sound('chime'); toast('Welcome. Make yourself at home.', '✳');
});
// A page restored from the back/forward cache starts fresh (nothing is kept between visits).
addEventListener('pageshow', event => { if (event.persisted) { state = createState(); ui = freshUi(); render(); } });

render();
document.querySelector('#app-notice').showModal();
