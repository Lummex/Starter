import { cards, cardById, starterDecks, STARTER_NAMES } from './cards.js';
import { rand } from './engine.js';

const PK = 'oreheart.profile.v1';
const MK = 'oreheart.match.v1';

function parseParams() {
  const q = new URLSearchParams(location.search);
  const p = {};
  if (q.has('seed') && q.get('seed') !== '' && !isNaN(+q.get('seed'))) p.seed = parseInt(q.get('seed'), 10);
  if (q.get('first') === 'you' || q.get('first') === 'enemy') p.first = q.get('first');
  if (q.get('hand')) p.hand = q.get('hand').split(',').map((x) => x.trim()).filter(Boolean);
  if (q.get('res')) {
    const a = q.get('res').split(',').map((x) => parseInt(x, 10));
    if (a.length === 3 && a.every((n) => !isNaN(n))) p.res = a;
  }
  if (q.get('ai') === 'off') p.ai = 'off';
  return p;
}
export const params = parseParams();
// global random stream (enemy deck choice, booster packs, match seeds)
export const grng = { rng: params.seed !== undefined ? params.seed : Math.floor(Math.random() * 2 ** 31) };
export const nextSeed = () => Math.floor(rand(grng) * 2 ** 31);

function starterCollection() {
  const col = {};
  for (const k of Object.keys(starterDecks)) for (const id of starterDecks[k]) col[id] = (col[id] || 0) + 1;
  return col;
}
const fresh = () => ({ gold: 50, collection: starterCollection(), decks: [], sound: true, music: true });

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(PK));
    if (raw && typeof raw.gold === 'number' && raw.collection) return { ...fresh(), ...raw };
  } catch { /* ignore */ }
  return fresh();
}
export let profile = load();
export function saveProfile() {
  try { localStorage.setItem(PK, JSON.stringify(profile)); } catch { /* ignore */ }
}
export function resetProgress() {
  const { sound, music } = profile;
  profile = { ...fresh(), sound, music };
  saveProfile();
  clearMatch();
}
export const ownedTotal = () => Object.values(profile.collection).reduce((a, b) => a + b, 0);

export function deckOptions() {
  const opts = Object.keys(starterDecks).map((k) => ({ value: k, label: STARTER_NAMES[k], ids: starterDecks[k] }));
  for (const d of profile.decks) opts.push({ value: d.id, label: d.name, ids: d.cards });
  return opts;
}

export function saveMatch(s) {
  try { localStorage.setItem(MK, JSON.stringify(s)); } catch { /* ignore */ }
}
export function loadMatch() {
  try {
    const m = JSON.parse(localStorage.getItem(MK));
    if (m && m.v === 1 && m.phase !== 'over') return m;
  } catch { /* ignore */ }
  return null;
}
export function clearMatch() {
  try { localStorage.removeItem(MK); } catch { /* ignore */ }
}

// booster pack
export function openPack() {
  const pick = () => {
    const r = rand(grng);
    const rar = r < 0.7 ? 'common' : r < 0.92 ? 'rare' : r < 0.99 ? 'epic' : 'legendary';
    return rar;
  };
  const rars = [0, 1, 2, 3, 4].map(pick);
  if (rars.every((r) => r === 'common')) rars[4] = 'rare';
  return rars.map((rar) => {
    const pool = cards.filter((c) => c.rarity === rar);
    return pool[Math.floor(rand(grng) * pool.length)].id;
  });
}
export function addToCollection(ids) {
  for (const id of ids) if (cardById[id]) profile.collection[id] = (profile.collection[id] || 0) + 1;
}
