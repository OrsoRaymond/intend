// Intend website: menu, day story tabs, motion, scroll pops, 3D tilt and soft sounds.
// Progressive enhancement: every section is readable without this file. No storage, no network.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Bars drawn from data-h (inline styles are not allowed by the CSP, so heights are set through the CSSOM).
document.querySelectorAll('[data-h]').forEach(el => el.style.setProperty('--h', `${Math.max(4, Math.min(100, Number(el.dataset.h) || 0))}%`));

// Mobile menu
const menu = document.querySelector('#site-menu');
const menuButton = document.querySelector('[data-menu-toggle]');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) { menu.classList.remove('is-open'); menuButton?.setAttribute('aria-expanded', 'false'); }
});

// Morning / daytime / evening story
const story = document.querySelector('.ritual-story');
const panels = [...document.querySelectorAll('[data-story-panel]')];
document.querySelectorAll('[data-story]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.story;
  document.querySelectorAll('[data-story]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  panels.forEach(panel => { panel.hidden = panel.dataset.storyPanel !== id; });
  if (story) story.dataset.phase = id;
  sound('tick');
}));
document.querySelectorAll('[role="tablist"]').forEach(list => list.addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const index = tabs.indexOf(document.activeElement);
  if (index < 0) return;
  event.preventDefault();
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next].focus(); tabs[next].click();
}));

// Gentle motion switch
const motionButton = document.querySelector('[data-motion-toggle]');
motionButton?.addEventListener('click', () => {
  const paused = document.documentElement.classList.toggle('motion-paused');
  motionButton.textContent = paused ? 'Play gentle motion' : 'Pause gentle motion';
  motionButton.setAttribute('aria-pressed', String(paused));
});

// Sections pop in as they scroll into view
if ('IntersectionObserver' in window && !reduced) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
  }), {threshold: .12});
  document.querySelectorAll('[data-reveal]').forEach(el => { el.classList.add('reveal-ready'); observer.observe(el); });
}

// 3D: cards lean toward the pointer, the hero stage follows the pointer and the scroll
const fine = matchMedia('(pointer: fine)').matches;
if (!reduced && fine) {
  document.querySelectorAll('.tilt').forEach(card => {
    card.addEventListener('pointermove', event => {
      const r = card.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width - .5, y = (event.clientY - r.top) / r.height - .5;
      card.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  });
}
const stage = document.querySelector('[data-stage] .stage-inner');
if (stage && !reduced) {
  let tx = -14, ty = 8, raf = 0;
  const apply = () => { raf = 0; stage.style.setProperty('--ry', `${tx.toFixed(2)}deg`); stage.style.setProperty('--rx', `${ty.toFixed(2)}deg`); };
  if (fine) addEventListener('pointermove', event => {
    tx = -14 + (event.clientX / innerWidth - .5) * 16; ty = 8 - (event.clientY / innerHeight - .5) * 10;
    if (!raf) raf = requestAnimationFrame(apply);
  }, {passive: true});
  addEventListener('scroll', () => { ty = 8 + Math.min(18, scrollY / 40); if (!raf) raf = requestAnimationFrame(apply); }, {passive: true});
}

// Soft sounds (Web Audio, generated on the fly). Only after a click, never on load.
let audio;
function sound(kind) {
  if (reduced) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
    const [from, to, len] = kind === 'pop' ? [520, 880, .16] : [740, 980, .07];
    osc.type = 'sine'; osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(to, t + len);
    gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.08, t + .015); gain.gain.exponentialRampToValueAtTime(.0001, t + len + .08);
    osc.connect(gain).connect(audio.destination); osc.start(t); osc.stop(t + len + .1);
  } catch { /* sound is a nicety */ }
}
document.querySelectorAll('[data-sound]').forEach(el => el.addEventListener('click', () => sound(el.dataset.sound)));
document.querySelectorAll('.faq summary').forEach(el => el.addEventListener('click', () => sound('tick')));
