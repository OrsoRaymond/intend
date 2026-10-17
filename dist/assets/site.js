const notice = document.querySelector('#preview-notice');
if (notice) {
  notice.showModal();
  document.querySelector('[data-dismiss-notice]').addEventListener('click', () => notice.close());
}
const menu = document.querySelector('#site-menu');
const menuButton = document.querySelector('[data-menu-toggle]');
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menu.classList.toggle('is-open', open);
});
menu?.addEventListener('click', event => {
  if (event.target.closest('a')) { menu.classList.remove('is-open'); menuButton.setAttribute('aria-expanded', 'false'); }
});
const story = document.querySelector('.ritual-story');
const panels = [...document.querySelectorAll('[data-story-panel]')];
document.querySelectorAll('[data-story]').forEach(button => button.addEventListener('click', () => {
  const id = button.dataset.story;
  document.querySelectorAll('[data-story]').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  panels.forEach(panel => { panel.hidden = panel.dataset.storyPanel !== id; });
  story.dataset.phase = id;
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
const motionButton = document.querySelector('[data-motion-toggle]');
motionButton?.addEventListener('click', () => {
  const paused = document.documentElement.classList.toggle('motion-paused');
  motionButton.textContent = paused ? 'Play gentle motion' : 'Pause gentle motion';
  motionButton.setAttribute('aria-pressed', String(paused));
});
// Progressive enhancement: content remains visible if scripts fail.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); observer.unobserve(entry.target); }
  }), {threshold: .08});
  document.querySelectorAll('[data-reveal]').forEach(el => { el.classList.add('reveal-ready'); observer.observe(el); });
}
