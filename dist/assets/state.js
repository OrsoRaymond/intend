// All personal input lives only in this module's caller-owned memory.
// No persistence, analytics, remote requests, or health/photo integrations.
export const HABITS = ['Step outside', 'Move my body', 'Read a few pages', 'Make space to rest', 'A real conversation', 'Take a mindful moment'];
export const MOODS = ['Depleted', 'A little low', 'Steady', 'Good', 'Really good'];
export const SAMPLE_WEEK = [3, 4, 3, 5, 4, 4, 5];
export const createState = () => ({
  onboarded: false, name: '', becoming: '', habits: HABITS.slice(0, 3).map((name, i) => ({id: i + 1, name, done: false})),
  nextHabitId: 4, water: 0, mode: 'morning', view: 'today', morning: null, evening: null,
  reflectionStyle: 'Both', reminderMorning: '08:00', reminderEvening: '20:30', weeklyNote: ''
});
export const escapeHTML = (text = '') => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function toggleHabit(state, id) {
  const habit = state.habits.find(h => h.id === Number(id));
  if (habit) habit.done = !habit.done;
}
export function addHabit(state, name) {
  const cleaned = String(name).trim().slice(0, 60);
  if (!cleaned || state.habits.length >= 8 || state.habits.some(h => h.name.toLowerCase() === cleaned.toLowerCase())) return false;
  state.habits.push({id: state.nextHabitId++, name: cleaned, done: false});
  return true;
}
export function changeWater(state, amount) {
  state.water = Math.max(0, Math.min(20, state.water + amount));
}
export function submitReflection(state, mode, draft) {
  if (!['morning', 'evening'].includes(mode)) throw new Error('Unknown reflection');
  if (!Number.isInteger(draft.mood) || draft.mood < 1 || draft.mood > 5) throw new Error('Choose how you feel');
  const allowed = mode === 'morning' ? ['intention','gratitude','great','mustDo'] : ['body','mind','good','word','promise'];
  const entry = {mood: draft.mood, completedAt: new Date().toISOString()};
  for (const key of allowed) entry[key] = String(draft[key] ?? '').trim().slice(0, 1200);
  state[mode] = entry;
  return entry;
}
