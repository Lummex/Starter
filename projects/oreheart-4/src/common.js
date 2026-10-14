import { BY_ID, SYMBOL, TYPE_NAME } from './cards.js';
export const nav = { go: () => {} };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ART = { Miner: '⛏️', Builder: '🔨', Warrior: '⚔️', Guardian: '🛡️', Raider: '🗡️', Siege: '🐏', Champion: '👑' };
export function artOf(c) {
  if (c.type === 's') return '✨';
  if (c.type === 'w') return c.kw.includes('gate') ? '🚪' : c.kw.includes('watchtower') ? '🗼' : '🧱';
  return c.dragon ? '🐉' : ART[c.role] || '⚔️';
}
export function statsOf(c) {
  return c.type === 'c' ? `${c.atk}/${c.hp}` : c.type === 'w' ? `♥${c.hp}` : '';
}
// Full card face. `u` optionally overrides live stats.
export function cardHTML(c, o = {}) {
  const st = o.unit ? (o.unit.type === 'c' ? `${o.unit.atk}/${o.unit.hp}` : `♥${o.unit.hp}`) : statsOf(c);
  return `<span class="card f-${c.faction} r-${c.rarity} ${o.cls || ''}">
<span class="gem" title="${c.rarity}"></span><span class="cost">${o.cost ?? c.cost}</span>
<span class="cfac">${SYMBOL[c.faction]}</span>
<span class="cname">${esc(c.name)}</span>
<span class="art">${artOf(c)}</span>
<span class="ctype">${TYPE_NAME[c.type]}${c.role ? ' · ' + c.role : ''}</span>
<span class="ctext">${esc(c.text)}</span>
<span class="flav">${esc(c.flavor)}</span>
<span class="cstat">${st}</span>
<span class="crar">${c.rarity}</span>
</span>`;
}
export const card = (id) => BY_ID[id];
