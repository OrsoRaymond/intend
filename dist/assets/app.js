// Intend app preview: a calm daily dashboard. Reflections, a mood scale, habits, water, a mood chart,
// quiet pop-ups and soft generated sounds. Everything lives in page memory only (see state.js).
import {createState, MOODS, SAMPLE_WEEK, escapeHTML as esc, addHabit, toggleHabit, changeWater, submitReflection} from './state.js';

const WATER_GOAL = 8;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = createState();
let ui = freshUi();
let toastTimer;
const root = document.querySelector('#app');
function freshUi() { return {view: 'today', sound: true, theme: 'day', period: 7, flow: null, quickMood: 0, shown: new Set(), lastFocus: null}; }

/* Line icons (no emoji anywhere) */
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/>',
  journal: '<path d="M6 3h11a1 1 0 0 1 1 1v16H7a2 2 0 0 1-2-2V4a1 1 0 0 1 1-1Z"/><path d="M5 17a2 2 0 0 1 2-2h11M9 7h5M9 10h3"/>',
  patterns: '<path d="M4 4v16h16"/><path d="m7 14 3.5-4 3 2.5L19 7"/>',
  recipe: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14Z"/><path d="M5 19 13 11"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  check: '<path d="m5 12.5 4.2 4.2L19 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  soundOn: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  soundOff: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="m17 10 4 4M21 10l-4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;
const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M8.5 20.5a7.5 7.5 0 0 1 15 0Z" fill="#a57d52"/><path d="M4 23.5h24" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10.5 27h11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".4"/></svg>';
const VIEWS = [['today', 'Today'], ['journal', 'Journal'], ['patterns', 'Patterns'], ['recipe', 'My recipe'], ['settings', 'My space']];

/* Soft generated sounds */
let audio;
function sound(kind) {
  if (!ui.sound || reduced) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const tone = (f, at, len, vol = .05, to) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t + at); if (to) o.frequency.exponentialRampToValueAtTime(to, t + at + len);
      g.gain.setValueAtTime(.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + .02); g.gain.exponentialRampToValueAtTime(.0001, t + at + len);
      o.connect(g).connect(audio.destination); o.start(t + at); o.stop(t + at + len + .05);
    };
    if (kind === 'tap') tone(560, 0, .12, .04, 700);
    else if (kind === 'done') { tone(523.25, 0, .35, .05); tone(783.99, .08, .45, .04); }
    else if (kind === 'undo') tone(600, 0, .14, .035, 420);
    else if (kind === 'water') tone(760, 0, .25, .05, 300);
    else if (kind === 'complete') [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(f, i * .1, .7, .045));
  } catch { /* sound is a nicety */ }
}

/* Helpers */
const dateLabel = () => new Intl.DateTimeFormat(undefined, {weekday: 'long', month: 'long', day: 'numeric'}).format(new Date());
function greeting() {
  const h = new Date().getHours();
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return state.name ? `${part}, <em>${esc(state.name)}</em>.` : `${part}.`;
}
const habitsDone = () => state.habits.filter(h => h.done).length;
function progress() {
  const parts = [state.morning ? 1 : 0, state.evening ? 1 : 0, state.habits.length ? habitsDone() / state.habits.length : 0, Math.min(1, state.water / WATER_GOAL)];
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
}
const todayMood = () => state.evening?.mood || state.morning?.mood || ui.quickMood || 0;
function applyVars(scope) {
  scope.querySelectorAll('[data-h]').forEach(el => el.style.setProperty('--h', `${Math.max(4, Math.min(100, Number(el.dataset.h) || 0))}%`));
  scope.querySelectorAll('[data-w]').forEach(el => el.style.setProperty('--w', `${Number(el.dataset.w) || 0}%`));
}

/* Shell */
function shell() {
  const nav = VIEWS.map(([key, label]) => `<button data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${label}</span>${key === 'today' && !state.morning ? '<span class="nav-dot" aria-label="Morning check-in waiting"></span>' : ''}</button>`).join('');
  root.innerHTML = `<div class="app-shell">
    <aside class="app-sidebar">
      <a href="/" class="brand" aria-label="Intend website">${LOGO}<span>intend</span></a>
      <nav class="app-nav" aria-label="App">${nav}</nav>
      <div class="sidebar-bottom">
        <p class="sidebar-quote">Your pace.<br>Your space.</p>
        <div class="sidebar-links"><a href="/">Website</a><a href="/privacy/" target="_blank" rel="noopener">Privacy</a><a href="/terms/" target="_blank" rel="noopener">Terms</a></div>
        <a class="sidebar-credit" href="https://otoro.si" target="_blank" rel="noopener noreferrer"><span class="label">Built and secured with</span><b>Orso Solutions × OTORO</b></a>
      </div>
    </aside>
    <main class="app-main" id="app-content" tabindex="-1"></main>
  </div>
  <nav class="mobile-tabs" aria-label="App">${VIEWS.map(([key, label]) => `<button data-view="${key}" ${ui.view === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${({recipe: 'Recipe', settings: 'You'})[key] || label}</span></button>`).join('')}</nav>`;
}
function topBar(title, subtitle) {
  return `<header class="app-top"><div class="app-heading"><p class="app-date">${dateLabel()}</p><h1 tabindex="-1">${title}</h1><p>${subtitle}</p></div>
    <div class="top-actions">
      <button class="icon-button" data-action="sound" aria-pressed="${ui.sound}" aria-label="${ui.sound ? 'Turn sounds off' : 'Turn sounds on'}">${icon(ui.sound ? 'soundOn' : 'soundOff')}</button>
      <button class="icon-button" data-action="theme" aria-pressed="${ui.theme === 'night'}" aria-label="Switch to the ${ui.theme === 'night' ? 'day' : 'evening'} look">${icon(ui.theme === 'night' ? 'moon' : 'sun')}</button>
      <button class="avatar" data-view="settings" aria-label="My space">${esc((state.name || 'You').slice(0, 1).toUpperCase())}</button>
    </div></header>`;
}
function render(focus = false) {
  document.body.dataset.theme = ui.theme;
  shell();
  const main = root.querySelector('#app-content');
  main.innerHTML = ({today, journal, patterns, recipe, settings})[ui.view]();
  applyVars(main);
  wire(main);
  if (focus) main.querySelector('h1')?.focus();
  if (ui.flow) renderFlow();
}

/* Pieces */
function ring(pct) {
  const c = 2 * Math.PI * 64;
  return `<div class="ring"><svg viewBox="0 0 150 150" aria-hidden="true"><circle class="track" cx="75" cy="75" r="64"/><circle class="fill" cx="75" cy="75" r="64" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg><strong>${pct}%</strong></div>`;
}
function scaleRow(selected, action, attr) {
  return `<div class="scale-row" role="group" aria-label="How do you feel, from 1 to 5">${MOODS.map((m, i) => `<button class="scale-button" ${attr}="${action}" data-mood="${i + 1}" aria-pressed="${selected === i + 1}"><span>${i + 1}</span><i data-w="${(i + 1) * 20}"></i><small>${m}</small></button>`).join('')}</div>`;
}
function chartSvg(values, labels) {
  const w = 640, h = 230, pad = 30, max = 5, step = (w - pad * 2) / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts.at(-1)[0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  const every = values.length > 10 ? 5 : 1;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Mood over ${values.length} days, out of five">
    <defs><linearGradient id="area-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b8986f" stop-opacity=".35"/><stop offset="1" stop-color="#b8986f" stop-opacity="0"/></linearGradient></defs>
    <g class="grid">${[1, 2, 3, 4, 5].map(v => `<line x1="${pad}" x2="${w - pad}" y1="${h - pad - v / max * (h - pad * 2)}" y2="${h - pad - v / max * (h - pad * 2)}"/>`).join('')}</g>
    <path class="area" d="${area}"/><path class="line" d="${line}"/>
    ${pts.map((p, i) => `<circle class="point" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5" tabindex="0" data-tip="${esc(labels[i])}: ${MOODS[Math.round(values[i]) - 1] || 'Steady'}"/>`).join('')}
    ${labels.map((l, i) => i % every === 0 || i === labels.length - 1 ? `<text x="${pts[i][0].toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(l)}</text>` : '').join('')}
  </svg>`;
}

/* Today */
function today() {
  const mode = !state.morning ? 'morning' : !state.evening ? 'evening' : null;
  const pct = progress();
  const values = SAMPLE_WEEK.slice(0, 6).concat(todayMood() || SAMPLE_WEEK[6]);
  const days = [...Array(7)].map((_, i) => i === 6 ? 'Today' : new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(new Date(Date.now() - (6 - i) * 864e5)));
  const headline = state.morning?.intention ? esc(state.morning.intention) : 'Make room for something good.';
  return `${topBar(greeting(), 'Your space to check in, reflect and notice what makes a good day.')}
  <div class="dash">
    <section class="tile feature span-8" aria-labelledby="t-intent"><div>
      <p class="label">${state.morning ? 'Today’s intention' : 'Your morning'}</p><h2 id="t-intent">${headline}</h2>
      <p>${state.morning ? `You started the day feeling ${MOODS[state.morning.mood - 1].toLowerCase()}.` : 'Two minutes to decide how you want to show up.'}</p>
      ${mode ? `<button class="button" data-action="flow" data-mode="${mode}">${mode === 'morning' ? 'Begin morning check-in' : 'Begin evening reflection'} ${icon('arrow')}</button>` : '<p class="label">Both bookends complete today</p>'}
    </div><div class="sun" aria-hidden="true"></div></section>
    <section class="tile span-4" aria-labelledby="t-progress"><p class="label">Today</p><h2 id="t-progress" class="sr-only">Today’s progress</h2>${ring(pct)}
      <div class="metrics"><div><span>Check-ins</span><b>${(state.morning ? 1 : 0) + (state.evening ? 1 : 0)} of 2</b></div><div><span>Habits</span><b>${habitsDone()} of ${state.habits.length}</b></div><div><span>Water</span><b>${state.water} of ${WATER_GOAL}</b></div></div></section>
    <section class="tile span-12" aria-labelledby="t-mood"><div class="tile-head"><div><p class="label">Quick check</p><h2 id="t-mood">How are you, right now?</h2></div>${todayMood() ? `<span class="count">${MOODS[todayMood() - 1]}</span>` : ''}</div>${scaleRow(todayMood(), 'mood', 'data-action')}</section>
    <section class="tile span-6" aria-labelledby="t-habits"><div class="tile-head"><div><p class="label">Habits</p><h2 id="t-habits">Small steps.</h2></div><span class="count">${habitsDone()}/${state.habits.length}</span></div>
      <div class="habit-list">${state.habits.map(h => `<button class="habit" data-action="habit" data-id="${h.id}" aria-pressed="${h.done}"><span class="box">${icon('check')}</span><span class="habit-name">${esc(h.name)}</span></button>`).join('')}</div>
      <div class="add-row"><label class="sr-only" for="new-habit">New habit</label><input id="new-habit" maxlength="60" placeholder="Add a habit"><button class="small-button" data-action="add-habit">Add</button></div></section>
    <section class="tile span-6" aria-labelledby="t-water"><div class="tile-head"><div><p class="label">Water</p><h2 id="t-water">${state.water >= WATER_GOAL ? 'Well topped up.' : 'A glass at a time.'}</h2></div><span class="count">${state.water}/${WATER_GOAL}</span></div>
      <div class="glasses" aria-hidden="true">${[...Array(WATER_GOAL)].map((_, i) => `<i class="${i < state.water ? 'full' : ''}"></i>`).join('')}</div>
      <div class="water-row"><strong>${state.water} <small>glasses today</small></strong><span class="add-row"><button class="small-button line" data-action="water" data-amount="-1" aria-label="Remove a glass">${icon('minus')}</button><button class="small-button" data-action="water" data-amount="1">Add a glass</button></span></div></section>
    <section class="tile span-8" aria-labelledby="t-week"><div class="tile-head"><div><p class="label">This week · sample and today</p><h2 id="t-week">Mood at a glance.</h2></div><button class="small-button line" data-view="patterns">Patterns</button></div><div class="chart-wrap">${chartSvg(values, days)}</div></section>
    <section class="tile span-4" aria-labelledby="t-evening"><p class="label">${state.evening ? 'One word for today' : 'Tonight'}</p><h2 id="t-evening">${state.evening?.word ? esc(state.evening.word) : 'What’s staying with you?'}</h2>
      <p>${state.evening ? 'Tomorrow is a new page.' : 'The good bits, the hard bits, and one word to remember the day by.'}</p></section>
  </div>`;
}

/* Journal */
function entry(mode) {
  const e = state[mode]; if (!e) return '';
  const labels = mode === 'morning' ? [['intention', 'Intention'], ['gratitude', 'Grateful for'], ['great', 'Would make today great'], ['mustDo', 'Must do']]
    : [['body', 'Body'], ['mind', 'Mind'], ['good', 'Good things'], ['word', 'Word of the day'], ['promise', 'For tomorrow']];
  const rows = labels.filter(([k]) => e[k]).map(([k, l]) => `<dt>${l}</dt><dd>${esc(e[k])}</dd>`).join('');
  return `<article class="tile entry"><div class="tile-head"><div><p class="label">${mode === 'morning' ? 'Morning check-in' : 'Evening reflection'}</p><h2>Feeling ${MOODS[e.mood - 1].toLowerCase()}</h2></div><button class="small-button line" data-action="flow" data-mode="${mode}">Edit</button></div>${rows ? `<dl>${rows}</dl>` : '<p>Just the check-in today.</p>'}</article>`;
}
function journal() {
  const any = state.morning || state.evening;
  return `${topBar('Journal', 'Today’s pages. They stay in this open page only.')}
  <div class="dash"><div class="span-7 habit-list">${any ? entry('morning') + entry('evening') : `<div class="tile empty"><p class="label">A fresh page</p><h2>Nothing written yet.</h2><p>Start with a two-minute morning check-in.</p><button class="button" data-action="flow" data-mode="morning">Begin ${icon('arrow')}</button></div>`}</div>
  <section class="tile span-5" aria-labelledby="j-week"><p class="label">Weekly note</p><h2 id="j-week">A note to your week.</h2><label class="sr-only" for="weekly-note">Weekly note</label><textarea id="weekly-note" maxlength="1200" placeholder="What do you want to remember about this week?">${esc(state.weeklyNote)}</textarea><div class="add-row"><button class="small-button" data-action="save-note">Keep this note</button></div></section></div>`;
}

/* Patterns */
function series(n) {
  return [...Array(n)].map((_, i) => Math.round(Math.max(1.4, Math.min(5, 3.3 + Math.sin(i * .9) * .9 + Math.cos(i * .37) * .5 + (i % 7 === 3 ? .6 : 0))) * 10) / 10);
}
function patterns() {
  const n = ui.period, values = series(n);
  const labels = values.map((_, i) => n === 7 ? new Intl.DateTimeFormat(undefined, {weekday: 'short'}).format(new Date(Date.now() - (n - 1 - i) * 864e5)) : `Day ${i + 1}`);
  const avg = (values.reduce((a, b) => a + b, 0) / n).toFixed(1);
  return `${topBar('Patterns', 'Illustrative sample data. Associations, never diagnoses.')}
  <div class="dash">
    <section class="tile span-8" aria-labelledby="p-trend"><div class="tile-head"><div><p class="label">Sample trend</p><h2 id="p-trend">Mood over ${n} days</h2></div>
      <div class="segmented" role="group" aria-label="Period">${[7, 30].map(p => `<button data-action="period" data-period="${p}" aria-pressed="${n === p}">${p} days</button>`).join('')}</div></div><div class="chart-wrap">${chartSvg(values, labels)}</div></section>
    <section class="tile span-4"><p class="label">Average</p><h2>${avg} <small>of 5</small></h2><p>Best day ${Math.max(...values).toFixed(1)}. Lowest ${Math.min(...values).toFixed(1)}.</p>
      <div class="bars small" aria-hidden="true">${[62, 70, 96, 74, 92, 66, 98].map((h, i) => `<div class="bar ${i === 2 || i === 6 ? 'best' : ''}"><i data-h="${h}"></i></div>`).join('')}</div></section>
    <section class="tile span-4"><p class="label">What lifts you</p><h2>Fresh air.</h2><p>In this sample, days with a walk scored higher.</p></section>
    <section class="tile span-4"><p class="label">Sleep</p><h2>Early nights help.</h2><p>Sample nights over seven hours sit next to steadier mornings.</p></section>
    <section class="tile span-4"><p class="label">People</p><h2>Conversations count.</h2><p>Sample days with a real conversation felt warmer.</p></section>
  </div>`;
}

/* Recipe */
function recipe() {
  return `${topBar('My recipe', 'A sample 30-day recipe for your good days. Personal recipes arrive later.')}
  <div class="dash"><section class="tile feature span-12"><div><p class="label">Your good-day recipe · sample</p><h2>A walk, a good talk, and an early night.</h2><p>Built from thirty days of example reflections.</p></div><div class="sun" aria-hidden="true"></div></section>
  <div class="span-12 recipe-grid"><div class="ingredient"><strong>4×</strong><p>more good days with time outside</p></div><div class="ingredient"><strong>7h</strong><p>of sleep before your best mornings</p></div><div class="ingredient"><strong>2</strong><p>real conversations a week, at least</p></div></div></div>`;
}

/* Settings */
function settings() {
  const sw = (action, on, label) => `<button class="switch" role="switch" aria-checked="${on}" data-action="${action}" aria-label="${label}"></button>`;
  return `${topBar('My space', 'Make it feel like yours. Preferences stay in this open page only.')}
  <div class="dash"><div class="span-7 settings-list">
    <div class="setting"><div><b>Your name</b><span>For a friendlier hello.</span></div><div class="add-row"><label class="sr-only" for="pref-name">Your name</label><input id="pref-name" maxlength="40" value="${esc(state.name)}" placeholder="Name or nickname"><button class="small-button" data-action="save-name">Save</button></div></div>
    <div class="setting"><div><b>Reflections</b><span>Which bookends you want.</span></div><label class="sr-only" for="pref-style">Reflection style</label><select id="pref-style" data-action="style">${['Both', 'Morning only', 'Evening only'].map(o => `<option ${state.reflectionStyle === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
    <div class="setting"><div><b>Sounds</b><span>Soft tones when you tick and finish things.</span></div>${sw('sound', ui.sound, 'Sounds')}</div>
    <div class="setting"><div><b>Evening look</b><span>Warm and dark for later in the day.</span></div>${sw('theme', ui.theme === 'night', 'Evening look')}</div>
    <div class="setting"><div><b>Reminders</b><span>Morning ${esc(state.reminderMorning)}, evening ${esc(state.reminderEvening)}. Arriving with the apps.</span></div></div>
    <div class="setting"><div><b>Start fresh</b><span>Clear everything in this preview.</span></div><button class="small-button line" data-action="reset">Clear</button></div>
  </div>
  <section class="tile span-5"><p class="label">Built and secured with</p><h2>Orso Solutions × OTORO</h2><p>No trackers, no third-party requests, nothing saved. Private by design.</p><div class="add-row"><a class="small-button" href="https://otoro.si" target="_blank" rel="noopener noreferrer">Visit OTORO</a></div></section></div>`;
}

/* Reflection flow, one question per screen */
const STEPS = {
  morning: [{key: 'mood', q: 'How’s your headspace this morning?'}, {key: 'intention', q: 'How do you want to show up today?', ph: 'Be here for the small things.'}, {key: 'gratitude', q: 'One thing you’re grateful for?', ph: 'Coffee that’s still warm.'}, {key: 'great', q: 'What would make today great?', ph: 'A walk before lunch.'}, {key: 'mustDo', q: 'One thing that has to get done?', ph: 'Call the dentist.'}],
  evening: [{key: 'mood', q: 'How are you feeling tonight?'}, {key: 'body', q: 'How does your body feel?', ph: 'Tired legs, good tired.'}, {key: 'mind', q: 'What’s on your mind?', ph: 'Tomorrow’s meeting.'}, {key: 'good', q: 'Three good things from today?', ph: 'Sun on the walk, a kind message, dinner.'}, {key: 'word', q: 'One word for today?', ph: 'Grounded'}, {key: 'promise', q: 'A small promise for tomorrow?', ph: 'Phone stays out of the bedroom.'}]
};
function startFlow(mode) { ui.flow = {mode, step: 0, draft: state[mode] ? {...state[mode]} : {}}; ui.lastFocus = document.activeElement; sound('tap'); renderFlow(); }
function renderFlow() {
  document.querySelector('.flow')?.remove();
  const f = ui.flow; if (!f) return;
  const steps = STEPS[f.mode], s = steps[f.step], last = f.step === steps.length - 1;
  const body = s.key === 'mood' ? scaleRow(f.draft.mood, 'mood', 'data-flow') : `<label class="sr-only" for="flow-input">${s.q}</label><textarea id="flow-input" maxlength="1200" placeholder="${esc(s.ph)}">${esc(f.draft[s.key] || '')}</textarea>`;
  const el = document.createElement('div');
  el.className = 'flow'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'flow-q');
  el.innerHTML = `<div class="flow-card"><div class="flow-progress" aria-hidden="true"><i data-w="${Math.round((f.step + 1) / steps.length * 100)}"></i></div>
    <p class="label">${f.mode === 'morning' ? 'Morning check-in' : 'Evening reflection'} · ${f.step + 1} of ${steps.length}</p><h2 id="flow-q">${s.q}</h2>${body}
    <div class="flow-actions"><button class="plain-button" data-flow="${f.step ? 'back' : 'close'}">${f.step ? 'Back' : 'Not now'}</button>
    <span class="add-row">${s.key !== 'mood' && !last ? '<button class="plain-button" data-flow="skip">Skip</button>' : ''}<button class="button" data-flow="next">${last ? 'Finish' : 'Continue'} ${icon('arrow')}</button></span></div></div>`;
  document.body.append(el);
  applyVars(el);
  (el.querySelector('textarea') || el.querySelector('.scale-button[aria-pressed="true"]') || el.querySelector('.scale-button'))?.focus();
}
function flowAction(action, target) {
  const f = ui.flow; if (!f) return;
  const steps = STEPS[f.mode];
  if (action === 'mood') { f.draft.mood = Number(target.dataset.mood); sound('tap'); renderFlow(); return; }
  if (action === 'close') { ui.flow = null; document.querySelector('.flow')?.remove(); ui.lastFocus?.focus?.(); return; }
  const input = document.querySelector('#flow-input'); if (input) f.draft[steps[f.step].key] = input.value;
  if (action === 'back') { f.step--; renderFlow(); return; }
  if (steps[f.step].key === 'mood' && !f.draft.mood) { toast('Choose a number from 1 to 5 first.'); return; }
  if (f.step < steps.length - 1) { f.step++; sound('tap'); renderFlow(); return; }
  try { submitReflection(state, f.mode, f.draft); } catch (error) { toast(error.message); return; }
  const mode = f.mode; ui.flow = null; document.querySelector('.flow')?.remove(); render(); sound('complete');
  milestone(mode, mode === 'morning' ? 'Morning check-in' : 'Evening reflection', mode === 'morning' ? 'A good place to start the day.' : 'Tomorrow is a new page.');
  if (state.morning && state.evening) setTimeout(() => milestone('both', 'Both bookends', 'A full day, in your own words.'), 1600);
}

/* Quiet pop-ups */
function toast(text) {
  const el = document.querySelector('#toast');
  el.innerHTML = `${icon('check')}<span>${esc(text)}</span>`;
  el.hidden = false; el.classList.remove('toast'); void el.offsetWidth; el.classList.add('toast');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}
function milestone(id, label, text) {
  if (ui.shown.has(id)) return; ui.shown.add(id);
  const el = document.createElement('div');
  el.className = 'milestone'; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="label">${esc(label)}</span><p>${esc(text)}</p>`;
  document.body.append(el); setTimeout(() => el.remove(), 4500);
}

/* Chart tooltips and gentle depth on tiles */
function wire(scope) {
  scope.querySelectorAll('.chart .point').forEach(point => {
    const show = () => {
      scope.querySelector('.chart-tip')?.remove();
      const wrap = point.closest('.chart-wrap'), r = point.getBoundingClientRect(), w = wrap.getBoundingClientRect();
      const tip = document.createElement('div'); tip.className = 'chart-tip'; tip.textContent = point.dataset.tip;
      tip.style.left = `${r.left - w.left + r.width / 2}px`; tip.style.top = `${r.top - w.top}px`; wrap.append(tip);
    };
    const hide = () => scope.querySelector('.chart-tip')?.remove();
    point.addEventListener('pointerenter', show); point.addEventListener('focus', show); point.addEventListener('pointerleave', hide); point.addEventListener('blur', hide);
  });
  if (reduced || !matchMedia('(pointer: fine)').matches) return;
  scope.querySelectorAll('.tile').forEach(card => {
    card.addEventListener('pointermove', event => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--ry', `${(((event.clientX - r.left) / r.width - .5) * 3).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-((event.clientY - r.top) / r.height - .5) * 3).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}

/* Events */
root.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) { ui.view = viewButton.dataset.view; sound('tap'); render(true); scrollTo(0, 0); return; }
  const btn = event.target.closest('[data-action]'); if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'flow') startFlow(btn.dataset.mode);
  else if (action === 'mood') { ui.quickMood = Number(btn.dataset.mood); sound('tap'); render(); toast(`Noted: ${MOODS[ui.quickMood - 1]}.`); }
  else if (action === 'habit') {
    toggleHabit(state, btn.dataset.id);
    const done = state.habits.find(h => h.id === Number(btn.dataset.id))?.done;
    sound(done ? 'done' : 'undo'); render();
    if (state.habits.length && habitsDone() === state.habits.length) { sound('complete'); milestone('habits', 'Habits', 'Every small step, done today.'); }
  } else if (action === 'add-habit') {
    const input = root.querySelector('#new-habit');
    if (addHabit(state, input.value)) { sound('done'); render(); toast('Habit added.'); root.querySelector('#new-habit')?.focus(); }
    else toast(state.habits.length >= 8 ? 'Up to eight habits in the preview.' : 'Try a new habit name.');
  } else if (action === 'water') {
    const before = state.water; changeWater(state, Number(btn.dataset.amount));
    if (state.water !== before) { sound(state.water > before ? 'water' : 'undo'); render(); }
    if (state.water >= WATER_GOAL && before < WATER_GOAL) milestone('water', 'Water', `${WATER_GOAL} glasses today. Well done.`);
  } else if (action === 'period') { ui.period = Number(btn.dataset.period); sound('tap'); render(); }
  else if (action === 'sound') { ui.sound = !ui.sound; render(); sound('tap'); toast(ui.sound ? 'Sounds on.' : 'Sounds off.'); }
  else if (action === 'theme') { ui.theme = ui.theme === 'night' ? 'day' : 'night'; sound('tap'); render(); }
  else if (action === 'save-name') { state.name = root.querySelector('#pref-name').value.trim().slice(0, 40); sound('done'); render(); toast(state.name ? `Nice to meet you, ${state.name}.` : 'Name cleared.'); }
  else if (action === 'save-note') { state.weeklyNote = root.querySelector('#weekly-note').value.slice(0, 1200); sound('done'); toast('Note kept for this session.'); }
  else if (action === 'reset') document.querySelector('#reset-dialog').showModal();
});
root.addEventListener('change', event => { if (event.target.matches('[data-action="style"]')) { state.reflectionStyle = event.target.value; toast(`Reflections: ${state.reflectionStyle}.`); } });
root.addEventListener('keydown', event => { if (event.key === 'Enter' && event.target.id === 'new-habit') root.querySelector('[data-action="add-habit"]').click(); });
document.addEventListener('click', event => { const b = event.target.closest('[data-flow]'); if (b) flowAction(b.dataset.flow, b); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && ui.flow) flowAction('close'); });
document.querySelector('#confirm-reset').addEventListener('click', () => { state = createState(); ui = {...freshUi(), sound: ui.sound}; document.querySelector('#reset-dialog').close(); render(true); toast('A fresh page.'); });
document.querySelector('#cancel-reset').addEventListener('click', () => document.querySelector('#reset-dialog').close());
document.querySelector('#accept-preview').addEventListener('click', () => { document.querySelector('#app-notice').close(); state.onboarded = true; sound('done'); });
addEventListener('pageshow', event => { if (event.persisted) { state = createState(); ui = freshUi(); render(); } });

render();
document.querySelector('#app-notice').showModal();
