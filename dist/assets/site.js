// Intend website: header, menu, slow parallax, gentle depth and scroll reveals.
// Progressive enhancement: every section reads fine without this file. No storage, no network.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

// Bar heights come from data-h (inline styles are not allowed by the CSP, so they are set through the CSSOM).
document.querySelectorAll('[data-h]').forEach(el => el.style.setProperty('--h', `${Math.max(4, Math.min(100, Number(el.dataset.h) || 0))}%`));

// Header turns solid once you scroll past the top of the photo
const header = document.querySelector('[data-header]');
const photo = document.querySelector('[data-hero-photo]');
let ticking = false;
function onScroll() {
  ticking = false;
  header?.classList.toggle('is-solid', scrollY > 40);
  if (photo && !reduced) photo.style.setProperty('--scroll', Math.min(1, scrollY / innerHeight).toFixed(3));
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, {passive: true});
onScroll();

// Mobile menu
const menu = document.querySelector('#site-menu');
const menuButton = document.querySelector('[data-menu-toggle]');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
  header?.classList.add('is-solid');
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) { menu.classList.remove('is-open'); menuButton?.setAttribute('aria-expanded', 'false'); }
});

// Reveal sections as they come into view
if ('IntersectionObserver' in window && !reduced) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
  }), {threshold: .15});
  document.querySelectorAll('[data-reveal]').forEach(el => { el.classList.add('reveal-ready'); observer.observe(el); });
}

// Depth: the check-in card and panels lean gently toward the pointer
if (!reduced && fine) {
  const lean = (el, strength, base = [0, 0]) => {
    el.addEventListener('pointermove', event => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--ry', `${(base[0] + ((event.clientX - r.left) / r.width - .5) * strength).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(base[1] - ((event.clientY - r.top) / r.height - .5) * strength).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--ry', `${base[0]}deg`); el.style.setProperty('--rx', `${base[1]}deg`); });
  };
  document.querySelectorAll('[data-tilt]').forEach(el => lean(el, 6));
  const card = document.querySelector('[data-scene-card]');
  if (card) {
    addEventListener('pointermove', event => {
      card.style.setProperty('--ry', `${(-12 + (event.clientX / innerWidth - .5) * 14).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(6 - (event.clientY / innerHeight - .5) * 10).toFixed(2)}deg`);
    }, {passive: true});
  }
}

// One soft, low click on the main buttons (generated, never on load)
let audio;
document.querySelectorAll('[data-sound]').forEach(el => el.addEventListener('click', () => {
  if (reduced) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(420, t); o.frequency.exponentialRampToValueAtTime(620, t + .12);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.05, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + .32);
  } catch { /* sound is a nicety */ }
}));
