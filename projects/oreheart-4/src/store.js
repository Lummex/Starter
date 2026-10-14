import { STARTER, STARTER_DECK } from './cards.js';
const KEY = 'oreheart-save-v1';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function fresh() {
  const collection = {};
  STARTER.forEach((id) => { collection[id] = 2; });
  return { gold: 300, collection, decks: [{ id: 'starter', name: 'Starter Deck', cards: STARTER_DECK.slice() }], settings: { sound: true, anim: !reduced() } };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && typeof s.gold === 'number' && s.collection && Array.isArray(s.decks) && s.decks.length) {
      s.settings = Object.assign({ sound: true, anim: !reduced() }, s.settings);
      return s;
    }
  } catch (e) { /* ignore */ }
  return fresh();
}
export const store = { data: load() };
export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(store.data)); } catch (e) { /* ignore */ }
}
export function resetAll() {
  store.data = fresh();
  persist();
}
