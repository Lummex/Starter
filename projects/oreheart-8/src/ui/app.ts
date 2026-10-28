import { arenaOpts } from './arena-fx';
import { mineEmblemUrl, ohCardEl, ohBackEl, commanderCard } from './cardfmt';
import { drawMenuScreen, menuScreens, ownerBox, freeBox } from './menus';
import { applyOwnerHud, hasTheme } from './owner-hud';
import { Game } from '../game';
import ownerLayoutJson0 from '../content/owner-layout.json';
import { CARDS, COMMANDERS, FACTIONS, CONFIG, ABILITIES, creatureCost, spellCost, hasMovesLeft, incomePreview, readyMinersAt, junkBonus, maxMove, isActed, mineTargets, funds, respondNeeds, sitesControlled, isMiner, other, ABILITY_COST, bankNeeded, movedThisPhase, shamanLiftTargets, shamanLandingSquares, shamanLiftAction } from '../engine';
import { SPELL_VISUALS } from '../content/spell-visuals';
import tutorialJson from '../content/tutorial.json';
import { STANCES } from '../ai/stances';
import { showDecks, loadDecks, deckLegal, storeDecks, hiddenStarters, setHiddenStarters } from './decks';
import { brewActions, flowShardCount, deckProblems, previewAttack, STARTER_DECK_LIST, STARTER_DECKS, warbandOf } from '../engine';
import { createBoardView, createFlatView, BoardView } from './scene';
import { audio } from './audio';
import { getHighlights, setHighlights, resetHighlights, getRings, setRings, resetRings, edgeOf, glowOf, mainOf, ringColor, applyHighlightVars } from './fx-settings';
import { loadGrubnak3d } from './grubnak3d';
import { mountGrubnakViewer, mountCreatureViewer } from './viewer3d';

type El = HTMLElement;
const SYM: Record<string, string> = { skull: '💀', gear: '⚙️', hammer: '🔨' };
/** Round 26 drag-card look (mirrored in the editors). */
const UI_SCALE = { commanderSpeech: 0.65, respond: 1.3 };
const DRAG_FX = { shrinkMs: 150, shrinkOpacity: 0.85, tiltMax: 8, legal: '#3ee06a', illegal: '#b04040' };
function homography(p: { x: number; y: number }[], w: number, h: number): string {
  const [p0, p1, p2, p3] = p;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0, hh = 0;
  if (Math.abs(sx) > 1e-6 || Math.abs(sy) > 1e-6) {
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den; hh = (dx1 * sy - sx * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + hh * p3.x, d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + hh * p3.y;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${p0.x},${p0.y},0,1)`;
}
const FSYM = (f: string) => SYM[FACTIONS[f]?.symbol] || '✦';
const PHASE: Record<string, string> = { deploy: 'Deploy', action: 'Action', mulligan: 'Mulligan', draw: 'Draw', end: 'End', over: 'Over' };
const ACTIVE = ['deploy', 'action'];
const BW: number = CONFIG.boardWidth, BH: number = CONFIG.boardHeight;
const SH = { player: { row: CONFIG.strongholds.player[0], col: CONFIG.strongholds.player[1] }, opponent: { row: CONFIG.strongholds.opponent[0], col: CONFIG.strongholds.opponent[1] } };
const shortName = (id: string) => id.toUpperCase();
/** Font scale (in card-widths) that fits `len` characters of ability text in a card's text box. */
const textScale = (len: number) => Math.min(0.1, 0.6 / Math.sqrt(Math.max(1, len)));
/** Full card face (cost, name, art symbol, stats, complete ability text). */
const RARITY_KEY: Record<string, string> = { Common: 'common', Uncommon: 'uncommon', Rare: 'rare', 'Ultra Rare': 'ultra-rare', Collector: 'collector' };
export const rarityKey = (c: any) => RARITY_KEY[c.rarity] || 'common';
/** Picture path of a card (Goblin creatures have a generated painting). */
/** Owner-supplied paintings (round 12a) override the generated art. */
export const OWNER_ART: Record<string, string> = { 'goblin-scrounger': '/art/owner/goblin/goblin-miner-card-art.png', 'goblin-pebbler': '/art/owner/goblin/boneknocker-card-art.png', 'shiv-rat': '/art/owner/goblin/shiv-rat-card-art.png', 'goblin-smith-miner': '/art/owner/goblin/scrapsmith-miner-card-art.png', 'goblin-sneak': '/art/owner/goblin/goblin-sneak-card-art.webp', 'goblin-bomber': '/art/owner/goblin/goblin-bomber-card-art.webp', 'goblin-scrapper': '/art/owner/goblin/goblin-scrapper-card-art.webp', 'grubnaks-big-boss-troll': '/art/owner/goblin/grubnaks-big-boss-troll-card-art.webp', 'junk-shaman': '/art/owner/goblin/junk-shaman-card-art.webp', 'wolf-rider': '/art/owner/goblin/wolf-rider-card-art.webp', 'rotgut-grenadier': '/art/owner/goblin/rotgut-grenadier-card-art.webp', 'shard-guzzler': '/art/owner/goblin/shard-guzzler-card-art.webp', 'blastrat-sapper': '/art/owner/goblin/blastrat-sapper-card-art.webp', 'hold-it': '/art/owner/goblin/hold-it-card-art.webp', 'tunnel-rush': '/art/owner/goblin/tunnel-rush-card-art.webp', 'goblin-grunt': '/art/owner/goblin/goblin-grunt-card-art.webp', 'skullbasher-rusher': '/art/owner/goblin/skullbasher-rusher-card-art.webp', 'goblin-slinger': '/art/owner/goblin/goblin-slinger-card-art.webp', 'gnome-tinker': '/art/owner/gnome/gnome-tinker-card-art.webp', 'gearward-sentinel': '/art/owner/gnome/gearward-sentinel-card-art.webp', 'gnome-prospector': '/art/owner/gnome/gnome-prospector-card-art.webp', 'glyphshield-warden': '/art/owner/gnome/glyphshield-warden-card-art.webp', 'clockwork-beetle': '/art/owner/gnome/clockwork-beetle-card-art.webp', 'gnome-illusionist': '/art/owner/gnome/gnome-illusionist-card-art.webp', 'the-great-steam-golem': '/art/owner/gnome/the-great-steam-golem-card-art.webp', 'spark-gnome': '/art/owner/gnome/spark-gnome-card-art.webp', 'gnome-cogger': '/art/owner/gnome/gnome-cogger-card-art.webp', 'fireball': '/art/owner/gnome/fireball-card-art.webp', 'meteor-strike': '/art/owner/gnome/meteor-strike-card-art.webp', 'spell-snap': '/art/owner/gnome/spell-snap-card-art.webp', 'gnome-smith-miner': '/art/owner/gnome/gnome-smith-miner-card-art.webp', 'axe-thrower': '/art/owner/dwarf/axe-thrower-card-art.webp', 'barrelback-courier': '/art/owner/dwarf/barrelback-courier-card-art.webp', 'brewmaster': '/art/owner/dwarf/brewmaster-card-art.webp', 'crystal-cluster': '/art/owner/neutral/crystal-cluster-card-art.webp', 'crystal-drunk-delver': '/art/owner/dwarf/crystal-drunk-delver-card-art.webp', 'deepforge-crossbowman': '/art/owner/dwarf/deepforge-crossbowman-card-art.webp', 'dwarf-miner': '/art/owner/dwarf/dwarf-miner-card-art.webp', 'dwarf-pickman': '/art/owner/dwarf/dwarf-pickman-card-art.webp', 'dwarf-stoneback': '/art/owner/dwarf/dwarf-stoneback-card-art.webp', 'fizzle': '/art/owner/neutral/fizzle-card-art.webp', 'glowing-geode': '/art/owner/neutral/glowing-geode-card-art.webp', 'gnome-widget': '/art/owner/gnome/gnome-widget-card-art.webp', 'grimhold-ravager': '/art/owner/dwarf/grimhold-ravager-card-art.webp', 'gyrocopter-ace': '/art/owner/gnome/gyrocopter-ace-card-art.webp', 'healing-light': '/art/owner/neutral/healing-light-card-art.webp', 'heart-of-the-fallen': '/art/owner/neutral/heart-of-the-fallen-card-art.webp', 'hexwright-apprentice': '/art/owner/gnome/hexwright-apprentice-card-art.webp', 'ironhammer-berserker': '/art/owner/dwarf/ironhammer-berserker-card-art.webp', 'motherlode': '/art/owner/neutral/motherlode-card-art.webp', 'oathbound-pikeman': '/art/owner/dwarf/oathbound-pikeman-card-art.webp', 'overclocked-conduit': '/art/owner/gnome/overclocked-conduit-card-art.webp', 'phase-stalker': '/art/owner/gnome/phase-stalker-card-art.webp', 'prospectors-prayer': '/art/owner/neutral/prospectors-prayer-card-art.webp', 'queen-brunhilda-stonebeard': '/art/owner/dwarf/queen-brunhilda-stonebeard-card-art.webp', 'ram-rider': '/art/owner/dwarf/ram-rider-card-art.webp', 'rune-splitter': '/art/owner/dwarf/rune-splitter-card-art.webp', 'runic-siphoner': '/art/owner/gnome/runic-siphoner-card-art.webp', 'second-wind': '/art/owner/dwarf/second-wind-card-art.webp', 'shield-bubble': '/art/owner/dwarf/shield-bubble-card-art.webp', 'shieldbeard': '/art/owner/dwarf/shieldbeard-card-art.webp', 'soul-shard': '/art/owner/neutral/soul-shard-card-art.webp', 'venom-shiv': '/art/owner/goblin/venom-shiv-card-art.webp', 'battle-cry': '/art/owner/dwarf/battle-cry-card-art.webp', 'dwarf-smith-miner': '/art/owner/dwarf/dwarf-smith-miner-card-art.webp' };
export const commanderPortrait = (id: string) => (id === 'grubnak' ? '/art/owner/goblin/grubnak-on-throne-art.png' : id === 'sproingle' ? '/art/owner/gnome/sproingle-portrait.webp' : id === 'borgo' ? '/art/owner/dwarf/borgo-portrait.webp' : `/art/commanders/${id}.webp`);
export const pictureOf = (c: any): string | null => (c && OWNER_ART[c.id]) ? OWNER_ART[c.id] : (c && ((c.type === 'creature' && c.faction === 'goblins') || (c.type === 'spell' && !c.disabled)) ? `/art/cards/${c.id}.webp` : null);
export const FRAME: Record<string, string> = { goblins: 'goblin', gnomes: 'gnome', dwarves: 'dwarf' };
export const frameKey = (c: any) => (c.type === 'spell' ? `spell-${FRAME[c.faction] || 'shared'}` : FRAME[c.faction] || 'neutral');
export function typeOf(c: any): { icon: string; name: string } {
  if (c.type === 'spell') return c.spellKind === 'regular' ? { icon: '🪄', name: 'Spell' } : { icon: '⚡', name: 'Instant' };
  if (c.type === 'crystal') return { icon: '💎', name: 'Crystal card' };
  const ab: string[] = c.abilities || [];
  if (c.role === 'Smith') return { icon: '⚒️', name: 'Smith Miner' };
  if (isMiner(c)) return { icon: '⛏️', name: 'Miner' };
  if (ab.includes('kaboom') || ab.includes('kaboom1')) return { icon: '💣', name: 'Bomb' };
  if (ab.includes('ranged')) return { icon: '🏹', name: 'Ranged' };
  if (ab.includes('guard')) return { icon: '🛡️', name: 'Guard' };
  return { icon: '⚔️', name: 'Fighter' };
}
/** Round 13: activated abilities that get a round button above their unit (icon, name, text; the cost comes from the engine). */
const ownerLayoutHand = (ownerLayoutJson0 as any).hud.find((p: any) => p.role === 'player-hand')?.hand;
/** Owner (Oct 24): comic pop-up pictures (public/art/pop) and speech bubbles (public/art/speech). */
const POP_WORD: Record<string, string> = { 'KA-BOOM!': 'ka-boom', 'CRUNCH!': 'crunch', 'BLOCK!': 'block', 'POOF!': 'ko', 'STRIKE!': 'strike', 'SHOCKWAVE!': 'shockwave', 'PLOW!': 'plow', 'CHARGE!': 'charge', 'YOINK!': 'yoink', 'WHOOSH!': 'whoosh', 'WARD!': 'ward', 'SACRIFICE!': 'sacrifice', 'BREW!': 'brew', 'BLINK!': 'blink' };
const HIT_POP: Record<string, string> = {
  'rotgut-grenadier': 'smack', 'goblin-grunt': 'bonk', 'goblin-pebbler': 'bonk', 'skullbasher-rusher': 'bonk', 'goblin-bomber': 'pow', 'grubnaks-big-boss-troll': 'pow', 'gnome-widget': 'pow',
  'goblin-sneak': 'stab', 'shiv-rat': 'stab', 'goblin-slinger': 'thwack', 'spark-gnome': 'zap', 'hexwright-apprentice': 'zap', 'deepforge-crossbowman': 'bang', 'gyrocopter-ace': 'fwoosh',
  'axe-thrower': 'thunk', 'oathbound-pikeman': 'thunk', 'ram-rider': 'charge', 'rune-splitter': 'charge', 'the-great-steam-golem': 'crunch', 'ironhammer-berserker': 'crunch', 'grimhold-ravager': 'crunch',
};
const CMD_VOICE: Record<string, string> = { grubnak: 'grubnak', sproingle: 'knobbin', borgo: 'borgo' };
const CMD_LINES: Record<string, Record<string, string>> = {
  start: { grubnak: 'lets-crack-some-skulls', knobbin: 'prepare-for-science', borgo: 'for-the-hold' },
  turn: { grubnak: 'move-it-maggots' },
  cheer: { grubnak: 'ha', knobbin: 'splendid', borgo: 'aye' },
  groan: { grubnak: 'ugh', knobbin: 'oh-dear', borgo: 'blast-it' },
  flinch: { grubnak: 'ow', knobbin: 'ouch', borgo: 'hmph' },
  cast: { knobbin: 'behold', borgo: 'by-the-anvil' },
  mine: { grubnak: 'mine', knobbin: 'mine', borgo: 'mine' },
  lostMine: { grubnak: 'that-was-my-crystal', knobbin: 'that-was-my-crystal', borgo: 'that-was-my-crystal' },
  impatient: { grubnak: 'any-day-now', knobbin: 'any-day-now', borgo: 'any-day-now' },
  low: { grubnak: 'part-of-the-plan', knobbin: 'part-of-the-plan', borgo: 'part-of-the-plan' },
  win: { grubnak: 'told-ya', knobbin: 'told-ya', borgo: 'told-ya' },
  lose: { grubnak: 'tactical-retreat', knobbin: 'tactical-retreat', borgo: 'tactical-retreat' },
};
const MSG_PIC: Record<string, string> = { 'THE CRYSTAL. HAS. FALLEN.': 'msg-the-crystal-has-fallen', 'Tap a target': 'msg-tap-a-target', 'Invalid target': 'msg-invalid-target', 'Cancelled': 'msg-cancelled' };
export const ABILITY_UI: Record<string, { icon: string; name: string; text: string; burst: string }> = {
  slide: { icon: '🚀', name: 'Slide', text: 'Runs in a straight line until it hits something, then goes Ka-boom.', burst: 'KA-BOOM!' },
  bowl: { icon: '🎳', name: 'Strike', text: 'Rolls a bowling ball in a straight line; every creature in its path is knocked back 1–2 spaces.', burst: 'STRIKE!' },
  shockwave: { icon: '💥', name: 'Shockwave', text: 'Knocks back all adjacent enemies 1 space and deals 1 damage to each.', burst: 'SHOCKWAVE!' },
  plow: { icon: '🚜', name: 'Plow', text: 'Plows in a straight line, shoving creatures aside.', burst: 'PLOW!' },
  ramMove: { icon: '🐏', name: 'Ram charge', text: 'Moves any distance in a straight line.', burst: 'CHARGE!' },
  shaman: { icon: '✋', name: 'Grab', text: 'Picks up any character within 5 spaces and puts it down within 5 spaces of the Shaman.', burst: 'YOINK!' },
  rocket: { icon: '🚀', name: 'Rocket Ride', text: 'Flies to any space; 3×3 explosion equal to its Attack.', burst: 'WHOOSH!' },
  ward: { icon: '🛡️', name: 'Ward', text: 'An ally gets Ward for one round.', burst: 'WARD!' },
  sacrifice: { icon: '🩸', name: 'Sacrifice', text: 'Sacrifice an ally to gain 1 Bank crystal.', burst: 'SACRIFICE!' },
  brew: { icon: '🍺', name: 'Brew', text: 'Once per turn, even on the enemy turn: heal an adjacent wounded dwarf (it survives lethal damage with 1 Health). It becomes Drunk for 2 rounds.', burst: 'BREW!' },
  blink: { icon: '✨', name: 'Blink', text: 'Once, swap places with any of your creatures.', burst: 'BLINK!' },
};
/** Owner-facing names of the activated abilities (the data-ability attribute); the engine keeps its own names. */
export const PUB_ABILITY: Record<string, string> = { slide: 'run', bowl: 'strike', shaman: 'pickUp', rocket: 'rocketRide', ramMove: 'gallop' };
export const INTERNAL_ABILITY: Record<string, string> = Object.fromEntries(Object.entries(PUB_ABILITY).map(([a, b]) => [b, a]));
export const RARITY_WORD: Record<string, string> = { Common: 'Common', Uncommon: 'Uncommon', Rare: 'Rare', 'Ultra Rare': 'Ultra Rare', Collector: 'Collector' };
const CRYSTAL_SVG = '<svg viewBox="0 0 24 32" focusable="false" aria-hidden="true" class="rc"><polygon points="12,1 20,10 12,31 4,10" fill="currentColor"/><polygon points="12,1 4,10 12,13" fill="#fff" fill-opacity=".62"/><polygon points="12,1 20,10 12,13" fill="#fff" fill-opacity=".25"/><polygon points="4,10 12,13 12,31" fill="#000" fill-opacity=".18"/><polygon points="20,10 12,13 12,31" fill="#000" fill-opacity=".42"/><polyline points="12,1 20,10 12,31 4,10 12,1" fill="none" stroke="#1a0f06" stroke-width="1.1" stroke-linejoin="round"/><path d="M4,10 L12,13 L20,10 M12,13 L12,31" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".6"/></svg>';
/** Card face on the owner's faction frame: cost, Attack, Health, Movement, type icon, picture, name, short text, rarity. */
/** Owner framing of the picture inside the art window: scale s, offset x/y in % of the window. */
export const artPosStyle = (c: any) => { const a = c?.artPos; if (!a) return null; return `transform:translate(${a.x || 0}%,${a.y || 0}%) scale(${a.s || 1});transform-origin:50% 50%`; };
export function faceKids(c: any, cost?: number, cur?: { attack?: number; health?: number; move?: number }): El[] {
  const shown = { ...c, cost: cost ?? c.cost, text: c.shortText || c.text || '' };
  if (c.type === 'creature' && cur) { if (cur.attack != null) shown.attack = cur.attack; if (cur.health != null) shown.health = cur.health; if (cur.move != null) shown.move = cur.move; }
  return [ohCardEl(shown, pictureOf(c))];
}
const roleBadge = (c: any) => (c.role === 'Smith' ? '⚒️' : isMiner(c) ? '⛏️' : '⚔️');
const COLOR_HEX: Record<string, string> = { green: '#3ee06a', blue: '#3fa9ff', purple: '#b45cff', white: '#f2f6ff' };

export function h(tag: string, attrs: Record<string, any> = {}, ...kids: (string | Node | null | undefined)[]): El {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids) if (k != null) e.append(k instanceof Node ? k : document.createTextNode(k));
  if (attrs['data-card-id'] != null) {
    const face = e.querySelector('.ohcard[data-layout]');
    if (face) { e.setAttribute('data-layout', face.getAttribute('data-layout')!); e.setAttribute('data-card-format', 'Card format final 1.0'); }
  }
  return e;
}
/** Ornate custom dropdown (ARIA combobox + floating listbox). `sel.value` holds the current choice; `onchange` fires on selection. */
const METAL: Record<string, string> = { dwarves: 'gold', gnomes: 'silver', goblins: 'rust' };
export function combo(label: string, id: string, opts: string[], onchange: () => void, asDiv = false) {
  const state = { value: opts[0] };
  const cb = h(asDiv ? 'div' : 'button', { ...(asDiv ? { tabindex: '0' } : { type: 'button' }), class: 'combo', id, role: 'combobox', 'aria-label': label, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': id + '-list' }, opts[0]);
  let lb: El | null = null;
  const close = () => { lb?.remove(); lb = null; cb.setAttribute('aria-expanded', 'false'); document.removeEventListener('pointerdown', away, true); };
  const away = (e: Event) => { if (lb && !lb.contains(e.target as Node) && e.target !== cb) close(); };
  const pick = (o: string) => { state.value = o; cb.textContent = o; close(); onchange(); cb.focus(); };
  const open = () => {
    if (lb) return close();
    lb = h('ul', { class: 'combo-list', id: id + '-list', role: 'listbox', 'aria-label': label },
      ...opts.map((o) => h('li', { role: 'option', tabindex: '0', 'aria-selected': String(o === state.value), class: o === state.value ? 'on' : '', onclick: () => pick(o), onkeydown: (e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(o); } else if (e.key === 'Escape') { close(); cb.focus(); } else if (e.key === 'ArrowDown') (e.target.nextElementSibling as El)?.focus(); else if (e.key === 'ArrowUp') (e.target.previousElementSibling as El)?.focus(); } }, o)));
    const r = cb.getBoundingClientRect();
    lb.style.left = r.left + 'px'; lb.style.top = r.bottom + 2 + 'px'; lb.style.minWidth = r.width + 'px';
    document.body.append(lb);
    const room = window.innerHeight - r.bottom - 8;
    if (room < 160) { lb.style.top = 'auto'; lb.style.bottom = window.innerHeight - r.top + 2 + 'px'; lb.style.maxHeight = r.top - 8 + 'px'; } else lb.style.maxHeight = room + 'px';
    cb.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', away, true);
    (lb.querySelector('.on') as El | null)?.focus();
  };
  cb.addEventListener('click', open);
  cb.addEventListener('keydown', (e: any) => { if (asDiv && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } else if (e.key === 'Escape') close(); else if (e.key === 'ArrowDown' && !lb) { e.preventDefault(); open(); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb) close(); });
  return { wrap: h('div', { class: 'f-field' }, h('span', { class: 'f-label', 'aria-hidden': 'true' }, label), cb), sel: state, set: (v: string) => { state.value = v; cb.textContent = v; } };
}
/** Round 6a: corner rings and filigree frames are gone; kept as an empty hidden stub so imports stay valid. */
export function ornament(): El {
  return h('div', { class: 'ornament-none', 'aria-hidden': 'true', hidden: true });
}
const svgEl = (tag: string, attrs: Record<string, string> = {}): El => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag) as unknown as El; for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
/** Owner (Oct 24): the end picture depends on how big the win or loss was, measured by the winning Commander's Health left (out of 20).
 *  Close (4 or less) -> close-win / so-close; even (5-10) -> victory / defeat (level 1);
 *  clear (11-16) -> you-won / defeated (level 2); a rout (17+) -> slaughter-victory / crushing-defeat (level 3). */
export function endBanner(win: boolean, st: any): string {
  const hp = Math.max(0, Number(st?.players?.[win ? 'player' : 'opponent']?.health ?? 10));
  if (hp <= 4) return win ? 'close-win' : 'so-close';
  if (hp <= 10) return win ? 'victory' : 'defeat';
  if (hp <= 16) return win ? 'you-won' : 'defeated';
  return win ? 'slaughter-victory' : 'crushing-defeat';
}
export const btn = (label: string, cls = '', onclick?: (e: Event) => void, attrs: Record<string, any> = {}) => h('button', { type: 'button', class: 'btn ' + cls, onclick, ...attrs }, label);

const GLOW_COLOR: Record<string, string> = { goblins: '#b45cff', gnomes: '#3fa9ff', dwarves: '#ffcf3a', any: '#fff0c2' };
export const GLOW_PEAK = 0.9;
/** Glow opacity (fraction of the peak) at 0/25/50/75/100 % of the thickness, measured from the card edge outward. */
export const GLOW_PROFILE = [1, 0.62, 0.34, 0.12, 0];
/** Owner faction colors (round 10): Goblins green, Gnomes purple, Dwarves navy blue. */
export const FACTION_GLOW: Record<string, string> = { goblins: '#3ee06a', gnomes: '#9b4dff', dwarves: '#2f5fd8' };
export class App {
  root: El;
  game: Game;
  test: boolean;
  seed?: number;
  view: BoardView | null = null;
  unsub: (() => void) | null = null;
  timerId: any = null;
  // match refs
  r: any = {};
  deadline = 0;
  phaseKey = '';
  endShown = false;
  respondTimer: any = null;
  fxLog: any[] = [];
  fxReal = false;
  get popups() { return localStorage.getItem('oreheart.popups') !== 'off'; }
  /** Step-by-step visual log (R2.16): one entry per reveal, effect, impact, damage, defeat, bounce, shatter and bomb step. */
  logFx(st: any, events: any[]) {
    const L = (kind: string, d: any = {}) => this.fxLog.push({ kind, ...d });
    const pop = this.popups;
    for (const e of events) {
      if (e.type === 'cast') {
        const respondable = st.pendingResponse && st.pendingResponse.responder === 'player' && e.player === 'opponent';
        if (pop && !respondable) { L('reveal', { cardId: e.cardId }); this.reveal(e.cardId, null, e.player ?? e.owner); }
      } else if (e.type === 'respond') { if (pop) { L('reveal', { cardId: e.cardId }); this.reveal(e.cardId, null, e.player ?? e.owner); } }
      else if (e.type === 'summon') { if (pop) { L('reveal', { cardId: e.cardId, uid: e.uid }); if (this.dialogCard === e.cardId + e.owner) this.dialogCard = ''; else this.reveal(e.cardId, e, e.player ?? e.owner); } }
      else if (e.type === 'playCrystal') { if (pop) { L('reveal', { cardId: e.cardId }); this.reveal(e.cardId, null, e.player ?? e.owner); } }
      else if (e.type === 'minerUpgrade') { if (pop) { L('reveal', { cardId: e.cardId }); this.reveal(e.cardId, e, e.player ?? e.owner); } }
      else if (e.type === 'spell') { L('effect', { cardId: e.cardId, visual: SPELL_VISUALS[e.cardId]?.id }); L('impact', { cardId: e.cardId }); }
      else if (e.type === 'poison') L('poison', { uid: e.uid, amount: 1 });
      else if (e.type === 'damage') L('damage', { uid: e.uid, amount: e.amount, commander: e.commander });
      else if (e.type === 'defeat') {
        L('defeat', { uid: e.uid, cardId: e.cardId });
        const ab: string[] = CARDS[e.cardId]?.abilities || [];
        if (ab.includes('kaboom') || ab.includes('kaboom1')) { L('bombDrop', { uid: e.uid }); L('boom', { uid: e.uid }); this.bombBoom(e); }
      }
      else if (e.type === 'bounce') L('bounce', { uid: e.uid, cardId: e.cardId });
      else if (e.type === 'counter' && e.countered) L('shatter', { cardId: e.countered });
    }
  }
  bombBoom(e: any) {
    if (!this.r.fx || !this.view) return;
    this.burst('KA-BOOM!', e.row, e.col);
  }
  pick: { cells: { row: number; col: number }[]; done: (c: { row: number; col: number }) => void; unit?: string } | null = null;
  handScroll = 0;
  lastOptions: any = {};
  lastTutorial = false;
  handKey = '';
  tokens = new Map<string, El>();
  dialogCard = '';
  respStart = 0;
  respSig = '';
  lastTap = { uid: '', t: 0 };
  tapTimer: any = null;
  dialogs: El[] = [];

  constructor(root: El, game: Game, test: boolean, seed?: number) {
    this.root = root;
    this.game = game;
    this.test = test;
    App.applyDisplay();
    this.fxReal = test && /[?&]fx=1/.test(location.search);
    this.seed = seed;
    if (test) document.body.classList.add('test');
    root.addEventListener('click', (e) => { if ((e.target as El).closest?.('button')) audio.play('click'); }, true);
  }

  // ------------------------------------------------------------ graphics setting
  get low() { return localStorage.getItem('oreheart.graphics') === 'low'; }
  gfxLabel() { return 'Graphics: ' + (this.low ? 'Low' : 'High'); }
  gfxButton(): El {
    const b = btn(this.gfxLabel(), '', () => {
      localStorage.setItem('oreheart.graphics', this.low ? 'high' : 'low');
      b.textContent = this.gfxLabel();
    });
    return b;
  }

  static applyDisplay() {
    const m = localStorage.getItem('oreheart.display') || 'auto';
    document.documentElement.dataset.display = m;
    window.dispatchEvent(new Event('resize'));
  }
  /** Display mode (R2.9): Auto fills the screen, PC locks 16:9, Phone locks about 19.5:9. */
  displayModeGroup(): El {
    const cur = localStorage.getItem('oreheart.display') || 'auto';
    const fs = h('fieldset', { class: 'display-mode', role: 'radiogroup', 'aria-label': 'Display mode' }, h('legend', {}, 'Display mode'));
    for (const [v, label] of [['auto', 'Auto'], ['pc', 'PC'], ['phone', 'Phone']]) {
      const id = `dm-${v}-${Math.random().toString(36).slice(2, 6)}`;
      const inp = h('input', { type: 'radio', name: 'display-mode', id, value: v, ...(cur === v ? { checked: true } : {}) }) as HTMLInputElement;
      inp.addEventListener('change', () => { if (inp.checked) { localStorage.setItem('oreheart.display', v); App.applyDisplay(); } });
      fs.append(h('span', { class: 'dm-opt' }, inp, h('label', { for: id }, label)));
    }
    return fs;
  }

  /** Flow particles (R5b.3): On / Reduced / Off, remembered; Reduced is the default on slow devices. */
  flowGroup(): El {
    const cur = localStorage.getItem('oreheart.flow') || (this.low ? 'reduced' : 'on');
    const fs = h('fieldset', { class: 'display-mode flow-mode', role: 'radiogroup', 'aria-label': 'Flow particles' }, h('legend', {}, 'Flow particles'));
    for (const [v, label] of [['on', 'On'], ['reduced', 'Reduced'], ['off', 'Off']]) {
      const id = `fp-${v}-${Math.random().toString(36).slice(2, 6)}`;
      const inp = h('input', { type: 'radio', name: 'flow-particles', id, value: v, ...(cur === v ? { checked: true } : {}) }) as HTMLInputElement;
      inp.addEventListener('change', () => { if (inp.checked) { localStorage.setItem('oreheart.flow', v); this.view?.setFlowMode(v); } });
      fs.append(h('span', { class: 'dm-opt' }, inp, h('label', { for: id }, label)));
    }
    return fs;
  }

  popupsSwitch(): El {
    const label = 'Card pop-ups';
    const b = h('button', { type: 'button', class: 'sw-btn', role: 'switch', 'aria-label': label, 'aria-checked': String(this.popups), title: label }, h('span', { class: 'sw-t', 'aria-hidden': 'true' }, this.popups ? 'Pop-ups On' : 'Pop-ups Off'));
    b.addEventListener('click', () => {
      localStorage.setItem('oreheart.popups', this.popups ? 'off' : 'on');
      b.setAttribute('aria-checked', String(this.popups));
      (b.querySelector('.sw-t') as El).textContent = this.popups ? 'Pop-ups On' : 'Pop-ups Off';
    });
    return b;
  }

  revealButton(): El {
    const label = () => 'Card reveals: ' + (localStorage.getItem('oreheart.reveal') === 'fast' ? 'Fast' : 'Normal');
    const b = btn(label(), '', () => {
      localStorage.setItem('oreheart.reveal', localStorage.getItem('oreheart.reveal') === 'fast' ? 'normal' : 'fast');
      b.textContent = label();
    });
    return b;
  }

  slider(label: string, id: string, value: number, on: (v: number) => void): El {
    const inp = h('input', { type: 'range', id, min: '0', max: '100', step: '1', value: String(value) }) as HTMLInputElement;
    inp.addEventListener('input', () => on(+inp.value));
    inp.addEventListener('change', () => audio.play('chime'));
    // two labels: the short visible one and a screen-reader one with the full name
    if (label === 'Sound effects volume') return h('div', { class: 'slider' }, h('label', { for: id }, 'Sound effects'), h('label', { for: id, class: 'sr-only' }, label), inp);
    return h('div', { class: 'slider' }, h('label', { for: id }, label), inp);
  }

  get askBank() { return localStorage.getItem('oreheart.askBank') !== 'off'; }
  askBankButton(): El {
    const label = () => 'Ask before using banked crystals: ' + (this.askBank ? 'On' : 'Off');
    const b = btn(label(), '', () => { localStorage.setItem('oreheart.askBank', this.askBank ? 'off' : 'on'); b.textContent = label(); });
    return b;
  }
  /** R26.A3: a payment that would use Bank crystals asks first (never in test mode, for act() or the AI). Calls go() when allowed. */
  payGate(cost: number, go: () => void) {
    const st = this.game.state;
    if (this.test || !st || cost <= 0 || !this.askBank || bankNeeded(st, 'player', cost) <= 0) { go(); return; }
    const name = 'Use your banked crystals?';
    const cb = h('input', { type: 'checkbox', id: 'dont-ask-bank' }) as HTMLInputElement;
    const d: any = this.dialog(name, [h('h2', {}, name),
      h('label', { for: 'dont-ask-bank', style: 'display:flex;gap:8px;justify-content:center;align-items:center;margin:6px 0' }, cb, "Don't ask again"),
      h('div', { class: 'row' },
        btn('Yes', 'primary', () => { if (cb.checked) localStorage.setItem('oreheart.askBank', 'off'); d.close(); go(); }),
        btn('No', '', () => d.close()))]);
  }
  remindButton(): El {
    const label = () => 'Moves reminder: ' + (this.remindMoves ? 'On' : 'Off');
    const b = btn(label(), '', () => {
      localStorage.setItem('oreheart.movesReminder', this.remindMoves ? 'off' : 'on');
      b.textContent = label();
    });
    return b;
  }

  clear() {
    audio.setMusicMode('menu');
    this.teardownMatch();
    this.root.replaceChildren();
    this.dialogs = [];
  }

  // ------------------------------------------------------------ simple screens
  /** Round 9c: the owner's Intro and Main menu screens (Menu Builder data), drawn by menus.ts. */
  private menuScreen(id: string, dataScreen: string) {
    this.clear();
    const sc = menuScreens.find((m) => m.id === id)!;
    const s = h('main', { class: 'screen menu-screen mb-screen', 'data-screen': dataScreen, 'aria-label': sc.name });
    this.root.append(s);
    const handle = drawMenuScreen(s, id, { go: (t) => this.menuGo(t) });
    (s.querySelector('.mb-root') as HTMLElement).style.animation = `mb-fade ${sc.transition?.ms ?? 400}ms ease-out`;
    (s as any)._menu = handle;
    if (id === 'main') {
      const img = s.querySelector('.mb-pc[data-id="mainLogo"] img') as HTMLImageElement | null;
      if (img) { const h1 = h('h1', { class: 'logo-h1' }); img.replaceWith(h1); img.alt = 'Oreheart'; h1.append(img); }
      else s.append(h('h1', { class: 'sr-only' }, 'Oreheart'));
      const dm = this.displayModeGroup(); dm.classList.add('title-display'); s.append(dm);
    }
    return s;
  }
  menuGo(t: string) {
    if (!t) { this.showRules(); return; }
    if (t === 'intro') this.showIntro();
    else if (t === 'main') this.showMenu();
    else if (t === 'commander') this.showSetup();
    else if (t === 'deck') showDecks(this);
    else if (t === 'action:settings-sound') this.showSettings();
    else if (t === 'action:quit') this.showIntro();
    else if (t === 'action:start-match') this.showSetup();
  }
  showIntro() {
    // real visitors always get the gate (audio needs a click); automated browsers go straight to the intro unless ?begin=1
    const gated = !audio.unlocked && (new URLSearchParams(location.search).get('begin') === '1' || (!this.test && !navigator.webdriver && !/Headless|Playwright/i.test(navigator.userAgent)));
    if (!gated) { this.menuScreen('intro', 'intro'); return; }
    // Browsers block audio until the first click/tap: a short gate, then the intro (crash sound, thunder) and the music can play
    this.clear();
    const go = h('button', { type: 'button', class: 'begin-btn', onclick: () => { audio.setMusicMode('menu'); this.menuScreen('intro', 'intro'); } }, 'Click to begin');
    this.root.append(h('main', { class: 'screen center begin-gate', 'data-screen': 'begin', 'aria-label': 'Begin' },
      h('div', { class: 'begin-stack', role: 'group', 'aria-label': 'Oreheart deck' }, ...[-14, -7, 0, 7, 14].map((deg, i) => h('div', { class: 'begin-card', 'data-layout': 'back', style: `--r:${deg}deg;--i:${i}` }, ohBackEl()))), h('h1', { class: 'sr-only' }, 'Oreheart'), go));
    go.focus();
  }
  showMenu() {
    const s = this.menuScreen('main', 'title');
    if (!this.test && !localStorage.getItem('oreheart.tutorialSeen')) {
      const d: any = this.dialog('Welcome to Oreheart!', [h('h2', {}, 'Welcome to Oreheart!'),
        h('p', { style: 'text-align:center;margin:0' }, 'New here? A short guided match teaches you the basics.'),
        h('div', { class: 'row' },
          btn('Start Tutorial', 'primary', () => { localStorage.setItem('oreheart.tutorialSeen', '1'); d.close(); this.beginTutorial(); }),
          btn('Skip', '', () => { localStorage.setItem('oreheart.tutorialSeen', '1'); d.close(); }))], () => s.classList.remove('welcome-on'));
      s.classList.add('welcome-on');
      d.el.dataset.sticky = '1';
      d.el.classList.add('welcome');
    }
  }

  showSettings() {
    this.clear();
    this.root.append(h('main', { class: 'screen center', 'data-screen': 'settings' },
      h('h1', { class: 'section cinzel' }, 'Settings'),
      h('div', { class: 'stack' }, this.gfxButton(), this.remindButton(), this.askBankButton(), this.revealButton(), this.popupsSwitch(), this.displayModeGroup(), this.flowGroup(), this.slider('Sound effects volume', 'sfx-vol', audio.sfx, (v) => audio.setSfx(v)), this.slider('Voices', 'voice-vol', audio.voice, (v) => audio.setVoice(v)), this.slider('Music volume', 'music-vol', audio.music, (v) => audio.setMusic(v)), btn('Restore starter decks', '', (e) => { setHiddenStarters([]); (e.currentTarget as HTMLElement).textContent = 'Starter decks restored'; }), ...this.fxPanels(), btn('Back', 'menu-back', () => this.showMenu()))));
  }

  /** The faction of the last picked Commander (defaults to Goblins): the default highlight / ring colors. */
  pickedFaction(): string { try { const p = JSON.parse(localStorage.getItem('oreheart.picks') || '{}'); return (COMMANDERS as any)[p.cmd]?.faction || 'goblins'; } catch { return 'goblins'; } }
  fxPanels(): El[] {
    const fac = this.pickedFaction();
    const ctl = (label: string, type: string, attrs: Record<string, any>, on: (v: any, el: HTMLInputElement) => void) => {
      const id = 'fx-' + label.toLowerCase().replace(/[^a-z]+/g, '-');
      const inp = h('input', { type, id, ...attrs }) as HTMLInputElement;
      inp.addEventListener('input', () => on(type === 'checkbox' ? inp.checked : type === 'range' ? +inp.value : inp.value, inp));
      return h('div', { class: 'slider fx-row' }, h('label', { for: id }, label), inp);
    };
    // square highlights
    const hv = getHighlights();
    const hlPrev = h('div', { class: 'hl-prev', 'aria-label': 'Highlight preview', role: 'img' }, h('div', { class: 'cell glow hl-prev-sq' }), h('div', { class: 'cell glow-attack hl-prev-sq' }));
    const hlSet = (p: any) => { setHighlights(p); applyHighlightVars(fac); };
    applyHighlightVars(fac);
    const hlPanel = h('section', { class: 'fx-panel', role: 'region', 'aria-label': 'Square highlights' }, h('h2', { class: 'section' }, 'Square highlights'), hlPrev,
      ctl('Edge color', 'color', { value: edgeOf(fac) }, (v) => hlSet({ edgeColor: v })),
      ctl('Glow color', 'color', { value: glowOf(fac) }, (v) => hlSet({ glowColor: v })),
      ctl('Attack color', 'color', { value: hv.attackColor }, (v) => hlSet({ attackColor: v })),
      ctl('Strength', 'range', { min: '0.2', max: '1', step: '0.05', value: String(hv.strength) }, (v) => hlSet({ strength: v })),
      ctl('Glow size', 'range', { min: '4', max: '60', step: '1', value: String(hv.glowSize) }, (v) => hlSet({ glowSize: v })),
      ctl('Edge thickness', 'range', { min: '1', max: '10', step: '1', value: String(hv.edgeThickness) }, (v) => hlSet({ edgeThickness: v })),
      ctl('Inner fill', 'range', { min: '0', max: '100', step: '1', value: String(hv.fill) }, (v) => hlSet({ fill: v })),
      ctl('Pulse', 'checkbox', hv.pulse ? { checked: '' } : {}, (v) => hlSet({ pulse: v })),
      ctl('Pulse speed', 'range', { min: '0.3', max: '3', step: '0.1', value: String(hv.pulseSpeed) }, (v) => hlSet({ pulseSpeed: v })),
      btn('Reset to default', '', () => { resetHighlights(); applyHighlightVars(fac); this.showSettings(); }));
    // unit rings
    const rv = getRings();
    const ringEl = (cls: string) => h('div', { class: 'ring-prev-dot ' + cls });
    const mine = ringEl('mine'), theirs = ringEl('theirs'), moved = ringEl('moved');
    const paint = () => {
      const r = getRings();
      for (const [el, c] of [[mine, ringColor('player', fac, false)], [theirs, ringColor('opponent', fac === 'goblins' ? 'dwarves' : 'goblins', false)], [moved, ringColor('player', fac, true)]] as [El, string][]) {
        el.style.borderColor = c; el.style.borderWidth = 2 + r.thickness * 3 + 'px'; el.style.opacity = String(r.opacity); el.style.boxShadow = `0 0 ${r.glow * 24}px ${c}, inset 0 0 ${r.glow * 14}px ${c}`;
      }
    };
    const rgSet = (p: any) => { setRings(p); paint(); };
    const ringPanel = h('section', { class: 'fx-panel', role: 'region', 'aria-label': 'Unit rings' }, h('h2', { class: 'section' }, 'Unit rings'),
      h('div', { class: 'ring-prev', 'aria-label': 'Ring preview', role: 'img' }, mine, theirs, moved),
      ctl('My ring color', 'color', { value: rv.myColor || mainOf(fac) }, (v) => rgSet({ myColor: v })),
      ctl('Enemy ring color', 'color', { value: rv.enemyColor || '#2f5fd8' }, (v) => rgSet({ enemyColor: v })),
      ctl('Moved color', 'color', { value: rv.movedColor || '#808080' }, (v) => rgSet({ movedColor: v })),
      ctl('Grey amount', 'range', { min: '0', max: '1', step: '0.05', value: String(rv.greyAmount) }, (v) => rgSet({ greyAmount: v })),
      ctl('Ring thickness', 'range', { min: '0.5', max: '3', step: '0.1', value: String(rv.thickness) }, (v) => rgSet({ thickness: v })),
      ctl('Ring glow', 'range', { min: '0', max: '1', step: '0.05', value: String(rv.glow) }, (v) => rgSet({ glow: v })),
      ctl('Ring opacity', 'range', { min: '0.2', max: '1', step: '0.05', value: String(rv.opacity) }, (v) => rgSet({ opacity: v })),
      btn('Reset to default', '', () => { resetRings(); this.showSettings(); }));
    paint();
    return [hlPanel, ringPanel];
  }

  showSetup() {
    this.clear();
    let picks: any = {};
    try { picks = JSON.parse(localStorage.getItem('oreheart.picks') || '{}') || {}; } catch { picks = {}; }
    const cmds = (Object.values(COMMANDERS) as any[]).filter((x) => x.playable !== false);
    let cmd = cmds.some((c) => c.id === picks.cmd) ? picks.cmd : 'grubnak';
    let diff = ['easy', 'normal', 'hard'].includes(picks.diff) ? picks.diff : 'normal';
    let mode = localStorage.getItem('oreheart.mode') || picks.mode || 'standard';
    if (!['standard', 'cardplay', 'compvscomp'].includes(mode)) mode = 'standard';
    const modeBtns: El[] = [];
    const decks = loadDecks();
    const FN: Record<string, string> = { goblins: 'goblin', gnomes: 'gnome', dwarves: 'dwarf' };
    const warband = () => warbandOf(COMMANDERS[cmd].faction);
    let deckSel = 'starter:' + warband();
    if (typeof picks.deck === 'string' && picks.deck !== '') { const i = decks.findIndex((d) => d.name === picks.deck && deckLegal(d, cmd)); if (i >= 0) deckSel = 'saved:' + i; }
    else if (typeof picks.deckId === 'string' && STARTER_DECKS[picks.deckId]) deckSel = 'starter:' + picks.deckId;
    const cmdBtns: El[] = [], diffBtns: El[] = [], stacks: El[] = [];
    const msg = h('p', { class: 'deck-msg', 'aria-label': 'Deck message', role: 'status' });
    const sel = () => {
      cmdBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === cmd)));
      modeBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === mode)));
      diffBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === diff)));
      stacks.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === deckSel)));
    };
    for (const c of cmds) {
      const f = FACTIONS[c.faction];
      cmdBtns.push(h('button', { type: 'button', class: `cmd-card f-${c.faction}`, 'data-id': c.id, 'aria-label': c.name, onclick: () => { if (picked && cmd === c.id) unpick(); else { cmd = c.id; onCmd(); pick(); } } },
        h('span', { class: 'portrait-img oh-cmd', 'aria-hidden': 'true' }, ohCardEl(commanderCard(c), commanderPortrait(c.id))),
        h('span', { class: 'cmd-win' },
          h('span', { class: 'nm' }, c.name),
          h('span', { class: 'fa' }, `${f.name} · ${f.faith}`),
          h('span', { class: 'ds' }, c.abilityText))));
    }
    for (const [id, label] of [['standard', 'Standard'], ['cardplay', 'Card Play'], ['compvscomp', 'Card Comp vs Card Comp']]) modeBtns.push(btn(label, 'diff mode-btn', () => { mode = id; this.game.setMode(id); try { localStorage.setItem('oreheart.mode', id); } catch { /* storage unavailable */ } sel(); }, { 'data-id': id }));
    for (const d of ['easy', 'normal', 'hard']) diffBtns.push(btn(d[0].toUpperCase() + d.slice(1), 'diff', () => { diff = d; sel(); }, { 'data-id': d }));
    const FCMD: Record<string, string> = { goblins: 'grubnak', gnomes: 'sproingle', dwarves: 'borgo' };
    const visibleCount = () => STARTER_DECK_LIST.filter((d) => d.faction === COMMANDERS[cmd].faction && !hiddenStarters().includes(d.id)).length + decks.filter((d) => !d.commander || d.commander === cmd).length;
    const confirmRemove = (label: string, doIt: () => void) => {
      const d: any = this.dialog('Remove deck?', [h('h2', {}, 'Remove deck?'), h('p', { style: 'text-align:center' }, `Remove ${label} from the deck picker?`),
        h('div', { class: 'row' }, btn('Remove', 'primary', () => { doIt(); d.close(); buildRow(); sel(); }), btn('Cancel', '', () => d.close()))]);
    };
    const stack = (label: string, n: number, ok: boolean, key: string, onpick: () => void, starterId?: string, savedIdx?: number) => {
      const b = h('button', { type: 'button', class: `dstack${ok ? '' : ' bad'}`, 'data-key': key, 'aria-label': `${label}, ${n} cards, ${ok ? 'ready' : 'not ready'}`, 'aria-disabled': ok ? null : 'true', onclick: onpick },
        h('img', { class: 'deck-img', src: '/art/deck/deck-menu.png', alt: '', draggable: 'false' }),
        h('span', { class: 'ds-name', 'aria-hidden': 'true' }, label), h('span', { class: 'ds-n', 'aria-hidden': 'true' }, `${n} cards ${ok ? '✔' : '⚠'}`));
      stacks.push(b);
      const rm = btn('Remove', 'small tx-act', () => confirmRemove(label, () => {
        if (starterId) setHiddenStarters([...hiddenStarters(), starterId]); else if (savedIdx != null) { decks.splice(savedIdx, 1); storeDecks(decks); }
        if (deckSel === key || deckSel.startsWith('saved:')) { const first = STARTER_DECK_LIST.find((d) => !hiddenStarters().includes(d.id)); deckSel = first ? 'starter:' + first.id : decks.length ? 'saved:0' : deckSel; }
      }), { 'aria-label': `Remove ${label}` }) as HTMLButtonElement;
      if (visibleCount() <= 1) { rm.disabled = true; rm.setAttribute('aria-disabled', 'true'); }
      const acts: El[] = [rm];
      if (starterId) acts.push(btn('Copy to my decks', 'small tx-act', () => {
        const sd: any = STARTER_DECK_LIST.find((x) => x.id === starterId)!;
        if (decks.length >= 5) { msg.textContent = 'You can save up to 5 decks.'; return; }
        decks.push({ name: `${label} (copy)`, cards: sd.cards.slice(), commander: FCMD[sd.faction] || 'grubnak' });
        storeDecks(decks);
        showDecks(this, { focus: decks.length - 1 });
      }, { 'aria-label': `Copy ${label} to my decks` }));
      return h('div', { class: 'dslot' }, b, h('div', { class: 'ds-acts' }, ...acts));
    };
    const row = h('div', { class: 'deck-row', 'aria-label': 'Deck choice', role: 'group' });
    const buildRow = () => {
      stacks.length = 0;
      const fac = COMMANDERS[cmd].faction;
      const order = ['goblins', 'gnomes', 'dwarves'];
      const hid = hiddenStarters();
      void order;
      const list = STARTER_DECK_LIST.filter((d) => d.faction === fac).filter((d) => !hid.includes(d.id));
      const items: El[] = list.map((d) => stack(d.name, d.cards.length, true, 'starter:' + d.id, () => { deckSel = 'starter:' + d.id; msg.textContent = ''; sel(); }, d.id));
      decks.forEach((d, i) => {
        if (d.commander && d.commander !== cmd) return;
        const ok = deckLegal(d, cmd);
        items.push(stack(d.name, d.cards.length, ok, 'saved:' + i, () => {
          if (!ok) { msg.textContent = deckProblems(d.cards.filter((id) => CARDS[id]), cmd)[0] || 'This deck is not ready.'; return; }
          deckSel = 'saved:' + i; msg.textContent = ''; sel();
        }, undefined, i));
      });
      items.push(h('div', { class: 'dslot' }, h('button', { type: 'button', class: 'dstack newdeck', onclick: () => showDecks(this) }, '+ New Deck')));
      row.replaceChildren(...items);
    };
    // round 8b item 11: choosing a Commander hides the others; the card drops back as a backdrop and the 3D model pops up in front
    let picked = false, stopStage: (() => void) | null = null;
    const stage = h('div', { class: 'cmd-stage', 'aria-hidden': 'true' }) as El;
    const cmdsEl = h('div', { class: 'cmds' }, h('div', { class: 'cmd-wall', 'aria-hidden': 'true' }), ...cmdBtns, stage) as El;
    // hover grow/shrink follows real pointer movement (a pointer left over a card by an earlier click doesn't count)
    cmdBtns.forEach((b) => {
      b.addEventListener('pointermove', () => { if (!b.classList.contains('hov')) { cmdBtns.forEach((o) => o.classList.toggle('hov', o === b)); cmdsEl.classList.add('hovering'); } });
      b.addEventListener('pointerleave', () => { b.classList.remove('hov'); if (!cmdBtns.some((o) => o.classList.contains('hov'))) cmdsEl.classList.remove('hovering'); });
    });
    const changeBtn = btn('Change Commander', 'change-cmd tx-act', () => unpick()) as El;
    changeBtn.hidden = true;
    const mainRef: { el: El | null } = { el: null };
    const pick = () => {
      picked = true;
      cmdsEl.classList.add('picked'); changeBtn.hidden = false;
      mainRef.el?.setAttribute('data-picked', cmd);
      cmdBtns.forEach((b) => b.classList.toggle('backdrop', b.dataset.id === cmd));
      stopStage?.(); stopStage = null; stage.replaceChildren();
      if (cmd === 'grubnak') {
        const mine = cmd;
        void mountGrubnakViewer(stage, { bare: true }).then((stop) => { if (!stop) return; if (!picked || cmd !== mine) { stop(); return; } stopStage = stop; stage.classList.add('pop'); });
      }
    };
    const unpick = () => {
      picked = false;
      stopStage?.(); stopStage = null; stage.replaceChildren(); stage.classList.remove('pop');
      cmdsEl.classList.remove('picked'); changeBtn.hidden = true;
      mainRef.el?.removeAttribute('data-picked');
      cmdBtns.forEach((b) => b.classList.remove('backdrop'));
    };
    const onEsc = (e: KeyboardEvent) => { if (!document.querySelector('[data-screen="select"]')) { document.removeEventListener('keydown', onEsc); return; } if (e.key === 'Escape' && picked) { e.stopPropagation(); unpick(); } };
    document.addEventListener('keydown', onEsc);
    const onCmd = () => {
      if (deckSel.startsWith('starter:') && !hiddenStarters().includes(warband())) deckSel = 'starter:' + warband();
      buildRow(); sel();
    };
    void FN;
    buildRow();
    sel();
    requestAnimationFrame(() => { row.scrollLeft = 0; });
    const scroll = (dir: number) => row.scrollBy({ left: dir * 220, behavior: 'smooth' });
    const startFn = () => {
          const others = Object.keys(COMMANDERS).filter((k) => k !== cmd && COMMANDERS[k].playable !== false);
          const opp = others[Math.floor(Math.random() * others.length)];
          const pick = deckSel.startsWith('saved:') ? decks[+deckSel.slice(6)] : null;
          const deckId = pick ? '' : deckSel.slice(8);
          try { localStorage.setItem('oreheart.picks', JSON.stringify({ cmd, diff, mode, deck: pick ? pick.name : '', deckId })); } catch { /* storage unavailable */ }
          this.beginMatch({ playerCommander: cmd, opponentCommander: opp, difficulty: diff, mode, ...(pick ? { playerDeck: pick.cards.slice() } : { playerDeckId: deckId }) });
    };
    const startBtn = h('div', { class: 'fight-wrap' }, btn('Fight!', 'primary fight-btn', startFn));
    const mainEl = h('main', { class: 'screen setup mb-setup', 'data-screen': 'select' },
      h('div', { class: 'mb-stage' },
        ownerBox('commander', 'cTitle', h('h1', { class: 'section cinzel cs-title' }, 'Choose Your Commander')),
        ownerBox('commander', 'cCards', [cmdsEl, changeBtn], 'cs-cards'),
        ownerBox('commander', 'cDecks', h('div', { class: 'deck-wrap' },
          btn('◀', 'small scroll', () => scroll(-1), { 'aria-label': 'Scroll decks left' }), row,
          btn('▶', 'small scroll', () => scroll(1), { 'aria-label': 'Scroll decks right' })), 'cs-decks'),
        freeBox(20, 88.2, 60, 11.8, [msg,
          h('div', { class: 'row mode-row', role: 'group', 'aria-label': 'Game mode' }, ...modeBtns),
          h('div', { class: 'row setup-actions', role: 'group', 'aria-label': 'Difficulty' },
            btn('Restore starter decks', '', () => { setHiddenStarters([]); buildRow(); sel(); }), ...diffBtns)], 'cs-extra'),
        ownerBox('commander', 'cStart', startBtn, 'cs-start'),
        ownerBox('commander', 'cBack', btn('Back', 'back-btn', () => this.showMenu()), 'cs-back')));
    mainRef.el = mainEl as El;
    this.selState = () => ({ mode: picked ? 'focused' : 'row', commanderId: cmd, model: picked && cmd === 'grubnak' && stage.classList.contains('pop') ? { shown: true, source: 'grubnak.glb', animation: 'idle' } : null });
    this.root.append(mainEl);
  }

  showRules() {
    this.clear();
    const svg = (label: string, body: string) => {
      const d = document.createElement('div');
      d.innerHTML = `<svg role="img" aria-label="${label}" viewBox="0 0 240 110" width="240" height="110" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
      return d.firstElementChild as El;
    };
    const board = svg('Picture of the board: enemy Stronghold at the top, three crystal sites in the middle, your Stronghold at the bottom',
      '<rect width="240" height="110" rx="10" fill="#4b3b2b"/><rect x="100" y="6" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="19" font-size="10" fill="#f4e9d0" text-anchor="middle">Enemy</text>' +
      '<polygon points="50,46 60,56 50,70 40,56" fill="#3ee06a"/><polygon points="120,46 130,56 120,70 110,56" fill="#f2f6ff"/><polygon points="190,46 200,56 190,70 180,56" fill="#b45cff"/>' +
      '<rect x="100" y="88" width="40" height="18" rx="4" fill="#77706a"/><text x="120" y="101" font-size="10" fill="#f4e9d0" text-anchor="middle">You</text>');
    const crystals = svg('Picture of three crystals: green for Goblins, blue for Gnomes, purple for Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><polygon points="40,20 65,55 40,95 15,55" fill="#3ee06a"/><polygon points="120,20 145,55 120,95 95,55" fill="#3fa9ff"/><polygon points="200,20 225,55 200,95 175,55" fill="#b45cff"/>' +
      '<text x="40" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Goblins</text><text x="120" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Gnomes</text><text x="200" y="106" font-size="9" fill="#f4e9d0" text-anchor="middle">Dwarves</text>');
    const combat = svg('Picture of type advantage: Dwarves beat Goblins, Goblins beat Gnomes, Gnomes beat Dwarves',
      '<rect width="240" height="110" rx="10" fill="#26232f"/><text x="120" y="30" font-size="16" fill="#f4e9d0" text-anchor="middle">🔨 → 💀 → ⚙️ → 🔨</text><text x="120" y="62" font-size="11" fill="#e3b54a" text-anchor="middle">+1 Attack on a type advantage</text><text x="120" y="86" font-size="11" fill="#f4e9d0" text-anchor="middle">Dwarves › Goblins › Gnomes › Dwarves</text>');
    const sec = (t: string, ...k: (string | El)[]) => h('section', {}, h('h2', {}, t), ...k.map((x) => (typeof x === 'string' ? h('p', {}, x) : x)));
    const s = h('main', { class: 'screen howto', 'data-screen': 'rules' },
      h('h1', { class: 'section cinzel' }, 'Rules'),
      sec('Goal', 'Bring the enemy Commander from 20 Health to 0 and they flee the battlefield. Commanders never die, they retreat! A Commander never heals by itself, so damage to them lasts.'),
      sec('The Board', 'Your crystal (Flow on the gem, Bank below it) is at the top-left, the enemy crystal at the top, the phase tracker at the top-right, your hand along the bottom and your deck at the bottom-right. A hidden grid 13 spaces wide and 7 deep. Your Stronghold sits in the bottom-left corner (row 7, column 2) and the enemy Stronghold in the top-right corner (row 1, column 12); the mines mirror from corner to corner. Summon creatures on your back row (the row next to your Stronghold). Only when your back row is full can you summon on the row in front of it. Three crystal mines sit in the middle rows, in a different place every match (mirrored between the two halves).', board),
      sec('Decks and auto-skip', 'The Decks screen on the main menu is a testing deck builder: every card is unlocked and you can save up to 5 decks of 50 to 100 cards (Rare, Ultra Rare and Collector cards max 3 copies, at most 20 Crystal cards). Pick a saved deck or the starter deck before a match. Your Deploy phase ends by itself when no card in your hand can be both paid for and placed, and your Action phase ends by itself when no creature can move, attack or mine.', crystals),
      sec('Crystals', 'There is only one kind of crystal: soul crystals. You have two counters. Flow is what you mined: on your turn drag a creature standing next to a mine onto the mine (only the 8 spaces touching a mine can mine it). Mining is the creature\'s action for the turn: a Miner mines 2 crystals, a Fighter 1. At the start of your next turn your Flow is SET to what you mined (it is not added) and never holds more than 16. Bank holds crystals from Crystal cards: it never resets and has no limit. Flow is spent first, then Bank. The side with more creatures that mined a mine owns it; a tie is neutral. Mining at an enemy-owned mine pays only half, rounded down (Miner 1, Fighter 0). Tapping a pulsing mine (it shows ⛏️ and a number) makes every ready Miner next to it mine at once; Fighters never join in, so drag them onto the mine yourself. Press and hold (or hover) a mine to see its info. You start with 0 crystals. If you own no mine while the enemy owns one you get 2 bonus crystals. The plus-N-next-turn counter shows your coming Flow, and holding a mine shows who owns it and what it pays.', crystals),
      sec('Mulligan and Camera', 'Before the match you may mulligan up to 3 times: tap cards, then Redraw Selected. Your first mulligan redraws as many cards as you swap; each later one redraws one fewer (5, then 4, then 3 cards). On the battlefield, pinch or use the mouse wheel to zoom, drag empty ground (or use two fingers) to pan, and choose Recenter in the Menu (right side) to reset. The Menu also holds Last turn, Mute, the Card pop-ups switch and Surrender. The Card pop-ups switch turns the big card reveals on or off; spell and ability animations always play. Tap a played card to pin it, tap a creature to read its card, and tap the card text for the full explanation. The Respond window opens only when you can actually play something.'),
      sec('Your Turn', 'Deploy: drag cards onto the board to summon creatures or cast spells, and play Crystal cards (any number, also at Instant speed while you respond). Every card you play is shown big in the middle of the screen for a moment first (change the speed in Settings; tap to skip). Miner upgrades: a basic Miner card played onto one of your own creatures gives it a permanent +1 Health; a Scrapsmith, Arcsmith or Anvilsworn Smith Miner gives +1 Attack and +1 Health (no limit). Played onto an empty back-row space they are summoned as Miners. Miners can move or mine, but not attack, the turn they are summoned. Action: each creature either moves OR attacks OR mines, never more than one (Charge creatures can do both). Drag a creature onto one of your own creatures to swap places. Press Done to end a phase; phases with nothing left to do are skipped.'),
      sec('Combat', 'Melee fights are simultaneous: both creatures hit each other at the same moment, so the defender strikes back even if it is defeated. Dwarves beat Goblins, Goblins beat Gnomes and Gnomes beat Dwarves for +1 Attack. Ranged creatures hit the first enemy up to 7 spaces away in one of the 8 straight directions (they cannot shoot past a unit) and get no strike back. Shield 1 blocks the next 1 damage. A creature that hits the Commander removes exactly its Attack. Damaged creatures show their Health in red.', combat),
      sec('Savings', 'If you end your own turn with 10 or more unspent Flow, every 10 Flow (rounded down) moves into your Bank as 1 banked crystal. Spells, Instants and Crystal cards never count as moves, so a turn with nothing else to do passes by itself.'),
      sec('Spells & Instants', 'Spells are cast by your Commander using crystals (Flow first, then Bank). Commanders never attack. Instants can answer the enemy during a "Respond?" window that lasts 12 seconds. It opens whenever you hold a matching Instant, even if you cannot pay for it yet: you can play a Crystal card on its own or together with a counterspell to pay for it. Counterspells cancel spells or summons.'),
      h('div', { class: 'stack', style: 'margin:10px 0 20px' }, btn('Tutorial', 'menu-fwd', () => this.beginTutorial()), btn('Back', 'menu-back', () => this.showMenu())));
    this.root.append(s);
  }

  // ------------------------------------------------------------ dialogs
  dialog(name: string, content: (El | string)[], onClose?: () => void): { close: () => void; el: El } {
    const dlg = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': name }, ...content);
    const ov = h('div', { class: 'overlay' }, dlg);
    const close = () => { ov.remove(); this.dialogs = this.dialogs.filter((d) => d !== ov); onClose && onClose(); };
    ov.addEventListener('pointerdown', (e: any) => { if (e.target === ov && !ov.dataset.sticky) close(); });
    ov.addEventListener('keydown', (e: any) => { if (e.key === 'Escape' && !ov.dataset.sticky) close(); });
    (this.root.querySelector('.match') || this.root).append(ov);
    this.dialogs.push(ov);
    const first = dlg.querySelector('button') as HTMLElement | null;
    first && first.focus({ preventScroll: true });
    return { close, el: ov };
  }

  showCard(cardId: string, creature?: any, hc?: any) {
    this.clearPops(); this.openHand(false, true);
    const c = CARDS[cardId];
    const rows: [string, string][] = [];
    rows.push(['Type', c.type === 'creature' ? `${FSYM(c.faction)} ${FACTIONS[c.faction].name} creature` : c.type === 'spell' ? ({ regular: 'Spell', instant: 'Instant', counter: 'Counterspell' } as any)[c.spellKind] : 'Crystal card']);
    rows.push(['Rarity', c.rarity]);
    const me = this.game.state?.players.player;
    const cost = c.type === 'creature' ? (me ? creatureCost(this.game.state, 'player', c) : c.cost) : c.type === 'spell' ? (me ? spellCost(this.game.state, 'player', c) : c.cost) : 0;
    rows.push(['Cost', c.type === 'crystal' ? 'Free' : `${cost}${cost !== c.cost ? ` (printed ${c.cost})` : ''}`]);
    if (c.type === 'creature') {
      rows.push(['Attack', String(creature ? creature.attack : c.attack)]);
      rows.push(['Health', creature ? `${creature.health}/${creature.maxHealth}` : String(c.health)]);
      rows.push(['Movement', String(c.move)]);
      rows.push(['Role', `${roleBadge(c)} ${c.role === 'Smith' ? 'Smith Miner' : isMiner(c) ? 'Miner' : 'Fighter'}`]);
      if (creature && creature.upgrades.attack + creature.upgrades.health) rows.push(['Miner upgrades', `+${creature.upgrades.attack} Attack, +${creature.upgrades.health} Health`]);
    }
    const dl = h('dl', { class: 'sr-only' });
    for (const [k, v] of rows) dl.append(h('dt', {}, k), h('dd', {}, v));
    const cur = creature ? { attack: creature.attack, health: creature.health, move: c.move } : undefined;
    const face = h('div', { class: `hand-card big static ${c.type} f-${c.faction}`, 'data-card-id': c.id, 'data-frame': frameKey(c), 'data-rarity': rarityKey(c) }, ...faceKids(c, cost, cur));
    const tx = face.querySelector('.ohtx[data-bind="text"]') as El;
    const tb = h('button', { type: 'button', class: 'tx-full', 'aria-label': 'Full explanation', title: 'Full explanation' });
    tb.style.cssText = 'position:absolute;inset:0;background:none;border:0;cursor:pointer;pointer-events:auto;z-index:99;padding:0';
    (tx?.parentElement || face).append(tb);
    tb.addEventListener('click', () => this.fullExplanation(c));
    // round 10: twice the old size, no scroll bar, no Close button; a click outside the card (or Esc) closes it
    // Owner (Oct 25): a hand card's close-up has a button that plays it (legal squares light up, then tap one)
    const kids: any[] = [h('div', { class: 'card-view-face' }, face), dl];
    let d: any = null;
    if (hc && this.game.state && this.game.state.phase !== 'over') {
      const label = c.type === 'spell' ? 'Cast this spell' : c.type === 'crystal' ? 'Play this Crystal' : 'Play this card';
      const can = this.game.legalActions().some((a: any) => a.uid === hc.uid);
      const pb = h('button', { type: 'button', class: 'primary play-from-hand' + (can ? '' : ' cant'), 'aria-disabled': String(!can), title: can ? label : this.explain(c) }, label) as HTMLButtonElement;
      pb.addEventListener('click', (ev) => { ev.stopPropagation(); d?.close(); this.tuckHand(); this.playFromHand(hc, c); setTimeout(() => this.tuckHand(), 0); });
      kids.push(h('div', { class: 'play-from-hand-row' }, pb));
    }
    // right-click on your own unit: its activated abilities as an ability menu under the card
    if (creature && creature.owner === 'player' && this.game.state && this.game.state.phase !== 'over') {
      const st = this.game.state;
      const keys = ((c.abilities || []) as string[]).filter((k) => ABILITY_UI[k]);
      const ready = new Set(this.game.legalActions().filter((a: any) => a.type === 'ability' && a.creatureUid === creature.uid).map((a: any) => a.ability));
      const row = h('div', { class: 'play-from-hand-row ability-row', role: 'group', 'aria-label': 'Abilities' });
      for (const k of keys) {
        const ui = ABILITY_UI[k], cost = k === 'blink' ? 1 : ABILITY_COST[k] || 0;
        const ok = ready.has(k) && st.priority === 'player';
        const b = h('button', { type: 'button', class: 'primary play-from-hand' + (ok ? '' : ' cant'), 'aria-disabled': String(!ok), title: ui.text }, `${ui.name}${cost ? ` (${cost})` : ''}`) as HTMLButtonElement;
        b.addEventListener('click', (ev) => { ev.stopPropagation(); if (!ok) { this.flash(ui.text); return; } d?.close(); const cr = this.game.state.board.creatures.find((x: any) => x.uid === creature.uid); if (cr) this.useAbility(cr, k); });
        row.append(b);
      }
      if (keys.length) kids.push(row);
    }
    d = this.dialog(c.name, kids);
    d.el.classList.add('cardview');
    return d;
  }
  /** Slide the hand back down: no raised card, no keyboard focus left on a hand card. */
  tuckHand() {
    const a = document.activeElement as HTMLElement | null;
    if (a && a.closest?.('.hand')) a.blur();
    this.clearPops(); this.openHand(false, true);
  }
  /** Play a hand card without dragging: no target = play now; otherwise its legal squares light up and a tap on one plays it. */
  playFromHand(hc: any, card: any) {
    const st = this.game.state;
    if (!st) return;
    this.pick = null; this.clearGlow();
    const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
    if (!legal.length) { this.flash(this.explain(card)); return; }
    const free = legal.find((a: any) => a.type === 'playCrystal' || (a.type === 'cast' && !a.target));
    if (free) { const r = this.game.act(free); if (r && !r.ok) this.flash(r.error); return; }
    const cells: any[] = [], smith: any[] = [];
    for (const a of legal) {
      if (a.type === 'summon') cells.push({ row: a.row, col: a.col });
      else if (a.type === 'minerUpgrade') { const o = st.board.creatures.find((x: any) => x.uid === a.creatureUid); if (o) smith.push({ row: o.row, col: o.col }); }
      else if (a.type === 'cast' && a.target) cells.push(this.cellOfTarget(a.target));
    }
    const all = [...cells, ...smith];
    if (!all.length) { this.flash(this.explain(card)); return; }
    this.dragKind = card.type;
    this.setGlow(cells, 'glow');
    this.setGlow(smith, 'glow-swap');
    this.pick = { cells: all, done: (c) => { this.pick = null; this.clearGlow(); this.dropCard(hc, card, c); setTimeout(() => this.tuckHand(), 0); } };
    this.flash(card.type === 'spell' ? 'Tap a target' : 'Tap a glowing square');
  }
  /** Deck builder close-up: the card fills the screen top to bottom; no Close button, no scrollbar; click anywhere or Esc dismisses. */
  closeUp(cardId: string, withViewer = false) {
    const isCmd = cardId.startsWith('cmd:');
    const c = isCmd ? ({ name: COMMANDERS[cardId.slice(4)].name, id: cardId, type: 'commander', faction: 'any' } as any) : CARDS[cardId];
    const face = isCmd ? h('div', { class: 'cz-img oh-cmd', role: 'img', 'aria-label': c.name, 'data-card-id': cardId }, ohCardEl(commanderCard(COMMANDERS[cardId.slice(4)]), commanderPortrait(cardId.slice(4)))) : h('div', { class: `hand-card big static ${c.type} f-${c.faction}`, 'data-card-id': c.id, 'data-frame': frameKey(c), 'data-rarity': rarityKey(c) }, ...faceKids(c, c.type === 'crystal' ? 0 : c.cost));
    const ov = h('div', { class: 'cardzoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.name }, face);
    let stopViewer: (() => void) | null = null, closed = false;
    const close = () => { closed = true; stopViewer?.(); ov.remove(); document.removeEventListener('keydown', onKey, true); };
    // round 8b item 14: cards with a 3D model (Grubnak) show it in a viewer beside the card
    if (withViewer && cardId === 'cmd:grubnak') {
      void mountGrubnakViewer(ov).then((stop) => {
        if (!stop) return;
        if (closed) { stop(); return; }
        stopViewer = stop; ov.classList.add('with-viewer');
      });
    }
    else if (withViewer && !isCmd && c.type === 'creature') {
      void mountCreatureViewer(ov, c).then((stop) => {
        if (!stop) return;
        if (closed) { stop(); return; }
        stopViewer = stop; ov.classList.add('with-viewer');
      });
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    document.body.append(ov);
    return { close, el: ov };
  }
  fullExplanation(c: any) {
    const d: any = this.dialog(`${c.name}: full explanation`, [h('h2', {}, c.name), h('p', { class: 'long-text' }, c.longText || c.text || ''), h('div', { class: 'row' }, btn('Close', 'primary', () => d.close()))]);
    d.el.addEventListener('pointerdown', (e: any) => { if (e.target.closest('.long-text')) d.close(); });
    return d;
  }

  // ------------------------------------------------------------ match
  beginMatch(options: any = {}) {
    this.enemyCrystalKey = "";
    const o = { ...options };
    if (o.seed == null && this.test && this.seed != null) o.seed = this.seed;
    this.lastOptions = options;
    this.lastTutorial = false;
    this.fxLog = [];
    arenaOpts.extra = (o.setup && o.setup.arenaExtraEffects) || [];
    const state = this.game.newMatch(o);
    applyHighlightVars(this.game.state.players.player.faction);
    this.showMatch();
    this.update(this.game.state, []);
    return state;
  }

  beginTutorial() {
    this.lastTutorial = true;
    this.fxLog = [];
    const state = this.game.startTutorial();
    applyHighlightVars(this.game.state.players.player.faction);
    this.showMatch();
    this.update(this.game.state, []);
    return state;
  }

  teardownMatch() {
    this.modeUi?.remove(); this.modeUi = null;
    clearInterval(this.timerId);
    clearTimeout(this.respondTimer);
    this.unsub && this.unsub();
    this.unsub = null;
    this.view && this.view.dispose();
    this.view = null;
    this.tokens.clear();
    this.r = {};
    this.endShown = false;
    this.fxStarted = false; this.uidCard.clear(); this.siteOwner.clear();
    this.pick = null;
    this.phaseKey = '';
    this.handKey = '';
    this.seenHand = new Set();
  }

  showMatch() {
    this.handKey = '';
    this.clear();
    audio.setMusicMode('match');
    const r = this.r;
    const fcol = FACTIONS[this.game.state.players.player.faction].crystal;
    void fcol;
    const crystalHud = (side: 'mine' | 'theirs') => {
      const you = side === 'mine';
      const gem = svgEl('svg', { class: 'cry-gem', viewBox: '0 0 100 130', role: 'img', 'aria-label': you ? 'Your soul crystal' : 'Enemy soul crystal' });
      const gid = 'cg' + side;
      gem.innerHTML = `<defs><linearGradient id="${gid}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${you ? '#d8f6ff' : '#ffd0c8'}"/><stop offset=".5" stop-color="${you ? '#3fb4ff' : '#ff4a3a'}"/><stop offset="1" stop-color="${you ? '#1a3f9a' : '#7a1010'}"/></linearGradient><linearGradient id="${gid}b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${you ? '#8fe0ff' : '#ff9a88'}"/><stop offset="1" stop-color="${you ? '#12306e' : '#5a0a0a'}"/></linearGradient><filter id="${gid}g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter></defs><polygon points="50,4 88,40 76,118 50,126 24,118 12,40" fill="${you ? '#4fc8ff' : '#ff5a4a'}" filter="url(#${gid}g)" opacity=".7"/><polygon points="50,4 88,40 50,52" fill="url(#${gid}a)"/><polygon points="50,4 12,40 50,52" fill="url(#${gid}b)" opacity=".9"/><polygon points="12,40 50,52 24,118" fill="url(#${gid}a)" opacity=".85"/><polygon points="88,40 50,52 76,118" fill="url(#${gid}b)"/><polygon points="50,52 24,118 50,126 76,118" fill="url(#${gid}a)" opacity=".95"/><polyline points="50,4 50,52 50,126" fill="none" stroke="#ffffff88" stroke-width="1.5"/><polygon points="40,18 52,14 46,34" fill="#fff" opacity=".7"/>`;
      const flow = h('span', { class: 'cry-flow', 'aria-label': you ? 'Your Flow crystals' : 'Enemy Flow crystals' }, '0');
      const bankN = h('span', { class: 'cry-bank-n' }, '0');
      const bank = h('span', { class: 'cry-bank', 'aria-label': you ? 'Your Bank crystals' : 'Enemy Bank crystals' }, bankN);
      const name = h('span', { class: 'cry-name' }, '');
      const next = h('span', { class: 'cry-next', 'aria-label': you ? 'Your income next turn' : 'Enemy income next turn' }, 'Next +0');
      const el = h('div', { class: 'crystal-hud ' + side, role: 'group', 'aria-label': you ? 'Your crystal' : 'Enemy crystal' },
        h('div', { class: 'cry-inner' },
          h('div', { class: 'cry-img' }, gem, flow, bank),
          h('div', { class: 'cry-text' }, name, h('span', { class: 'cry-word' }, 'Flow'), next)));
      return { el, flow, bank: bankN, name, next };
    };
    const yc = crystalHud('mine'), ec = crystalHud('theirs');
    r.crFlow = yc.flow; r.crBank = yc.bank; r.income = yc.next; r.myName = yc.name;
    r.eFlow = ec.flow; r.eBank = ec.bank; r.eNext = ec.next; r.eName = ec.name;
    r.enemyHand = h('div', { class: 'enemy-hand', role: 'img', 'aria-label': 'Enemy hand' });
    r.enemyDeck = h('div', { class: 'pile', role: 'img', 'aria-label': 'Enemy deck' }, h('img', { class: 'deck-img', src: '/art/deck/deck-menu-deck-pile.png', alt: '', draggable: 'false' }), h('span', { class: 'pile-n' }, '0'));
    r.enemyHealth = h('div', { class: 'heart theirs', role: 'img', 'aria-label': 'Enemy Commander health' }, '20');
    r.phase = h('div', { class: 'phase', role: 'status', 'aria-label': 'Current phase' });
    r.phase.append(h('div', { class: 'ph-turn' }), h('div', { class: 'ph-steps' }, ...['draw', 'deploy', 'action', 'end'].map((k) => h('span', { class: 'ph-step', 'data-phase': k }, PHASE[k]), ), ), h('div', { class: 'ph-time' }));
    (r.phase.querySelector('.ph-steps') as El).replaceChildren(...['draw', 'deploy', 'action', 'end'].flatMap((k, i) => (i ? [h('span', { class: 'ph-sep', 'aria-hidden': 'true' }, '›'), h('span', { class: 'ph-step', 'data-phase': k }, PHASE[k])] : [h('span', { class: 'ph-step', 'data-phase': k }, PHASE[k])])));
    r.timer = h('div', { class: 'countdown', role: 'timer', 'aria-label': 'Phase timer', hidden: true }, '10');
    r.board = h('div', { class: 'board', role: 'application', 'aria-label': 'Battlefield' });
    r.fx = h('div', { class: 'fx' });
    r.myHealth = h('div', { class: 'heart mine', role: 'img', 'aria-label': 'Your Commander health' }, '20');
    r.myDeck = h('div', { class: 'pile', role: 'img', 'aria-label': 'Your deck' }, h('img', { class: 'deck-img', src: '/art/deck/deck-menu-deck-pile.png', alt: '', draggable: 'false' }), h('span', { class: 'pile-n' }, '0'));
    r.done = btn('Done', 'primary done-btn', () => this.pressDone());
    r.recenter = btn('Recenter', 'recenter-btn', () => { this.resetCam(); this.menuOpen(false); });
    r.swap = btn('Swap for a Miner', 'swap-btn', () => this.startSwap());
    r.swap.hidden = true;
    r.hand = h('div', { class: 'hand', role: 'group', 'aria-label': 'Your hand' });
    r.handLeft = btn('◀', 'hand-scroll left', () => { this.handScroll = Math.max(0, Math.round(this.handScroll) - 3); this.layoutHand(); }, { 'aria-label': 'Scroll hand left' });
    r.handRight = btn('▶', 'hand-scroll right', () => { this.handScroll = Math.round(this.handScroll) + 3; this.layoutHand(); }, { 'aria-label': 'Scroll hand right' });
    r.handLeft.hidden = true; r.handRight.hidden = true;
    const menuBtn = btn('Menu', 'menu-btn', () => { this.menuPinned = !this.menuPinned; this.menuOpen(this.menuPinned); }, { 'aria-expanded': 'false', 'aria-haspopup': 'menu' });
    const syncMute = () => {
      muteBtn.setAttribute('aria-pressed', String(audio.muted)); muteBtn.setAttribute('aria-label', 'Mute'); muteBtn.textContent = audio.muted ? 'Muted' : 'Mute';
      spk.setAttribute('aria-pressed', String(audio.muted)); spk.setAttribute('aria-label', audio.muted ? 'Unmute sound' : 'Mute sound'); spk.textContent = audio.muted ? '🔇' : '🔊';
    };
    const toggleMute = () => { audio.setMuted(!audio.muted); syncMute(); if (!audio.muted) audio.play('click'); };
    const muteBtn = btn('Mute', 'mute-btn', toggleMute);
    const spk = btn('🔊', 'spk-btn', toggleMute);
    syncMute();
    r.last = btn('Last turn', 'last-btn', () => { this.menuOpen(false); this.showLastTurn(); });
    const surrenderBtn = btn('Surrender', 'surrender-btn', () => {
      this.menuOpen(false);
      const c: any = this.dialog('Surrender this match?', [h('h2', {}, 'Surrender this match?'),
        h('div', { class: 'row' }, btn('Yes, surrender', 'danger', () => { c.close(); this.game.act({ type: 'surrender' }); }), btn('Cancel', '', () => c.close()))]);
    });
    r.menuPanel = h('div', { class: 'menu-panel', id: 'match-menu-panel', hidden: true });
    r.menuBtn = menuBtn;
    r.spk = spk;
    r.menuWrap = h('div', { class: 'hud-menu', 'aria-label': 'Menu controls', role: 'group' }, menuBtn, r.menuPanel);
    void muteBtn; void surrenderBtn;
    r.tip = h('aside', { class: 'tip', 'aria-label': 'Tutorial tip', hidden: true });
    const match = h('main', { class: 'match' },
      r.board,
      r.swap,
      r.tip, r.hand, r.handLeft, r.handRight, r.timer);
    this.root.append(match);
    this.buildModeUi();
    const ps = this.game.state.players;
    applyOwnerHud(match, r, {
      playerFaction: ps.player.faction, enemyFaction: ps.opponent.faction,
      closeMenu: () => this.menuOpen(false),
      menuItems: [
        { label: 'Resume', run: () => {} },
        { label: 'Settings', run: () => this.matchSettings() },
        { label: 'How to play', run: () => this.matchHowTo() },
        { label: 'Sound Effects', run: () => this.matchVolume('Sound Effects') },
        { label: 'Background music', run: () => this.matchVolume('Background music') },
        { label: 'Give up match!', run: () => { const c: any = this.dialog('Give up this match?', [h('h2', {}, 'Give up this match?'), h('div', { class: 'row' }, btn('Yes, give up', 'danger', () => { c.close(); this.game.act({ type: 'surrender' }); }), btn('Cancel', '', () => c.close()))]); } },
      ],
    });
    document.addEventListener('pointerdown', (e) => { if (this.r.menuWrap?.classList.contains('open') && !(e.target as Element).closest?.('.o-menu')) this.menuOpen(false); }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.selectedUid = null; if ((this.pick as any)?.lift) this.cancelLift('Cancelled'); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.r.menuWrap?.classList.contains('open')) { this.menuOpen(false); this.r.menuBtn?.focus(); } });
    // board layers
    r.cells = new Map<string, El>();
    r.sites = [];
    r.rings = []; r.hits = [];
    r.flows = [];
    r.view = null;
    try { this.view = createBoardView(r.board, this.low); } catch { this.view = null; }
    if (!this.view) this.view = createFlatView(r.board);
    this.view.onViewChange = () => this.layoutSoon();
    for (let row = 1; row <= BH; row++) for (let col = 1; col <= BW; col++) {
      const c = h('div', { class: 'cell', 'data-row': row, 'data-col': col });
      r.cells.set(row + ',' + col, c);
      r.board.append(c);
    }
    (this.game.state.sites as any[]).forEach(({ row, col }, i) => {
      const ring = h('div', { class: 'mine-decal', 'aria-hidden': 'true' });
      const hit = h('div', { class: 'mine-hit', 'aria-hidden': 'true', onclick: () => { if (!this.holdFired) this.tapSite(i); } });
      hit.dataset.row = String(row); hit.dataset.col = String(col); r.hits.push(hit); r.board.append(hit);
      ring.dataset.row = String(row); ring.dataset.col = String(col);
      const fl = h('div', { class: 'mine-flow', role: 'img', 'aria-label': `Mine flow, row ${row}, column ${col}` }, '+0 / +0');
      fl.dataset.row = String(row); fl.dataset.col = String(col);
      r.rings.push(ring); r.flows.push(fl); r.board.append(ring, fl);
      const m = h('button', { type: 'button', class: 'site-mark', 'aria-label': `Crystal site, row ${row}, column ${col}`, onclick: () => this.tapSite(i) });
      m.dataset.row = String(row); m.dataset.col = String(col);
      m.dataset.readyMiners = '0';
      m.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.holdFired = false;
        clearTimeout(this.holdTimer);
        this.holdTimer = setTimeout(() => { this.holdFired = true; this.openSite(i, 'hold'); }, 500);
      });
      const endHold = () => clearTimeout(this.holdTimer);
      m.addEventListener('pointerup', endHold);
      m.addEventListener('pointercancel', endHold);
      m.addEventListener('pointerleave', endHold);
      m.addEventListener('pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') this.openSite(i, 'hover'); });
      m.addEventListener('pointerleave', (e: PointerEvent) => { if (e.pointerType === 'mouse' && this.siteTipMode === 'hover') this.closeSiteTip(); });
      r.sites.push(m); r.board.append(m);
    });
    r.strong = {} as any;
    for (const side of ['player', 'opponent']) {
      const s = h('div', { class: 'stronghold ' + side, role: 'img', 'aria-label': side === 'player' ? 'Your Stronghold' : 'Enemy Stronghold' }, '🏰');
      r.strong[side] = s; r.board.append(s);
    }
    r.board.append(r.enemyHealth, r.myHealth, r.fx);
    const ro = new ResizeObserver(() => this.layout());
    ro.observe(r.board);
    this.unsub = this.game.subscribe((st, ev) => this.update(st, ev));
    this.cam = { zoom: 1, x: 0, y: 0 };
    this.setupCamera();
    let hoverT: any = null, hoverEl: El | null = null, hoverKey = '';
    const clearHover = () => { clearTimeout(hoverT); hoverEl?.remove(); hoverEl = null; hoverKey = ''; };
    r.board.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.buttons) { clearHover(); return; }
      const c = this.cellAt(e.clientX, e.clientY);
      const cr = c && this.game.state?.board.creatures.find((x: any) => x.row === c.row && x.col === c.col);
      const key = cr ? cr.uid : '';
      if (key === hoverKey) return;
      clearHover(); hoverKey = key;
      if (!cr || !this.popups) return;
      hoverT = setTimeout(() => {
        const card = CARDS[cr.cardId];
        const rc = this.view!.cellRect(cr.row, cr.col);
        const el = h('div', { class: `hand-card static hover-card ${card.type} f-${card.faction}`, 'aria-hidden': 'true', 'data-card-id': card.id, 'data-frame': frameKey(card), 'data-rarity': rarityKey(card) }, ...faceKids(card, card.cost, { attack: cr.attack, health: cr.health, move: card.move }));
        r.board.append(el); hoverEl = el;
        const bw = r.board.clientWidth, bh = r.board.clientHeight, cw2 = el.offsetWidth, ch2 = el.offsetHeight;
        el.style.left = Math.max(cw2 / 2 + 4, Math.min(bw - cw2 / 2 - 4, rc.x + rc.w / 2)) + 'px';
        let top = rc.y - 4;
        if (top - ch2 < 4) top = rc.y + rc.h + ch2 + 4;
        el.style.top = Math.max(ch2 + 4, Math.min(bh - 4, top)) + 'px';
      }, 400);
    });
    r.board.addEventListener('pointerleave', clearHover);
    r.board.addEventListener('pointerdown', clearHover, true);
    r.board.addEventListener('pointerdown', (e: PointerEvent) => { if (this.touches.size < 2) this.boardPointerDown(e); });
    r.hand.addEventListener('wheel', (e: WheelEvent) => { e.preventDefault(); this.handScroll += (e.deltaY || e.deltaX) / 80; this.layoutHand(); }, { passive: false });
    document.addEventListener('pointerdown', this.tuckOutside, true);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('resize', () => this.placeEnemyCrystal());
    setInterval(() => this.placeEnemyCrystal(), 400);
    window.removeEventListener('keydown', this.onKey);
    window.addEventListener('keydown', this.onKey);
    clearInterval(this.timerId);
    this.timerId = setInterval(() => { this.tick(); this.pumpBanner(); }, 100);
    requestAnimationFrame(() => this.layout());
  }
  onResize = () => { this.layout(); };
  /** Short title shown; the rest of the full display name stays in the text for screen readers. */
  setCmdName(el: El, full: string) {
    if (el.dataset.full === full) return;
    el.dataset.full = full;
    const m = full.match(/^(.*?)(,| the )(.*)$/);
    el.replaceChildren(m ? h('span', {}, m[1]) : full, m ? h('span', { class: 'sr-only' }, m[2] + m[3]) : '' as any);
  }
  menuPinned = false;
  flowKey = '';
  flowTurn = -1;
  matchSettings() {
    const mute = btn('Mute', 'mute-btn', () => { audio.setMuted(!audio.muted); mute.setAttribute('aria-pressed', String(audio.muted)); }, { 'aria-pressed': String(audio.muted) });
    const c: any = this.dialog('Match settings', [h('h2', {}, 'Settings'), h('div', { class: 'stack' },
      this.popupsSwitch(),
      btn('Last turn', 'last-btn', () => { c.close(); this.showLastTurn(); }),
      btn('Recenter', 'recenter-btn', () => { this.resetCam(); c.close(); }),
      mute,
      this.slider('Music volume', 'music-vol', audio.music, (v) => audio.setMusic(v)),
      this.slider('Sound effects volume', 'sfx-vol', audio.sfx, (v) => audio.setSfx(v)),
      btn('Close', '', () => c.close()))]);
  }
  matchHowTo() {
    const c: any = this.dialog('How to play', [h('h2', {}, 'How to play'),
      h('p', {}, 'Draw, Deploy, Action, End. Drag cards onto your back row to summon. Drag a creature to move or attack. Tap a mine to mine with every ready Miner next to it. Mined Flow resets each turn; Crystal cards go to the Bank and stay. When a basic Miner is defeated you draw a card. Win by taking the enemy Commander to 0 Health.'),
      h('div', { class: 'row' }, btn('Close', '', () => c.close()))]);
  }
  matchVolume(which: 'Sound Effects' | 'Background music') {
    const c: any = this.dialog(which, [h('h2', {}, which),
      which === 'Sound Effects' ? h('div', { class: 'stack' }, this.slider('Sound effects volume', 'sfx-vol', audio.sfx, (v) => audio.setSfx(v)), this.slider('Voices', 'voice-vol', audio.voice, (v) => audio.setVoice(v)))
        : h('div', { class: 'stack' }, this.slider('Music volume', 'music-vol', audio.music, (v) => audio.setMusic(v)), btn(audio.musicOn ? 'Music: On' : 'Music: Off', 'music-toggle', (e) => { audio.setMusicOn(!audio.musicOn); (e.currentTarget as El).textContent = audio.musicOn ? 'Music: On' : 'Music: Off'; })),
      h('div', { class: 'row' }, btn('Close', '', () => c.close()))]);
  }
  menuOpen(on: boolean) {
    const r = this.r;
    if (!r.menuPanel) return;
    if (!on) this.menuPinned = false;
    r.menuPanel.hidden = !on;
    r.menuBtn.setAttribute('aria-expanded', String(on));
    r.menuWrap.classList.toggle('open', on);
  }
  modeUi: El | null = null;
  buildModeUi() {
    this.modeUi?.remove(); this.modeUi = null;
    const g = this.game, mode = g.mode;
    if (mode === 'standard') return;
    const fac = this.game.state.players.player.faction;
    const col = (FACTIONS as any)[fac]?.crystal || '#ffd700';
    const wrap = h('div', { class: 'mode-ui', style: `--stance-glow:${col}` });
    const col4 = h('div', { class: 'stance-col', role: 'group', 'aria-label': 'Stance' }, ...STANCES.map((st) => btn('', 'stance-btn', () => { g.setStance(st.id); this.refreshModeUi(); }, { 'data-stance': st.id, title: st.desc, 'aria-label': st.label })));
    col4.querySelectorAll('button').forEach((b, i) => { b.append(h('span', { class: 'st-icon', 'aria-hidden': 'true' }, STANCES[i].icon), h('span', { class: 'st-label' }, STANCES[i].label)); });
    const bar = mode === 'compvscomp'
      ? h('div', { class: 'watch-bar', role: 'group', 'aria-label': 'Watch controls' },
          btn(g.paused ? 'Play' : 'Pause', 'wb-pause', () => { g.setPaused(!g.paused); this.refreshModeUi(); }),
          ...[1, 2, 4].map((n) => btn(n + '×', 'wb-speed', () => { g.setSpeed(n); this.refreshModeUi(); }, { 'data-speed': n })),
          btn('Exit', 'wb-exit', () => { g.act({ type: 'surrender' }); this.showMenu(); }, { 'aria-label': 'Exit to menu', title: 'Exit to menu' }))
      : h('div', { class: 'watch-bar cp-bar', role: 'group', 'aria-label': 'Card Play controls' },
          btn('1×', 'wb-speed', () => { g.setSpeed(1); this.refreshModeUi(); }, { 'data-speed': 1 }),
          btn('2×', 'wb-speed', () => { g.setSpeed(2); this.refreshModeUi(); }, { 'data-speed': 2 }));
    wrap.append(col4, bar);
    this.root.append(wrap);
    this.modeUi = wrap;
    this.refreshModeUi();
  }
  refreshModeUi() {
    const w = this.modeUi, g = this.game;
    if (!w) return;
    w.querySelectorAll<El>('.stance-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.stance === g.stance)));
    w.querySelectorAll<El>('.wb-speed').forEach((b) => b.setAttribute('aria-pressed', String(+(b.dataset.speed || 1) === g.speed)));
    const p = w.querySelector('.wb-pause'); if (p) p.textContent = g.paused ? 'Play' : 'Pause';
  }
  /** "Done" is shown only during the player's own Deploy/Action phase with priority and no dialog open. */
  syncDone() {
    const r = this.r, st = this.game.state;
    if (!r.done || !st) return;
    const mine = st.priority === 'player' && st.activePlayer === 'player' && ACTIVE.includes(st.phase) && !st.pendingResponse && !this.movesDlg && !this.root.querySelector('.overlay, .dialog');
    const show = mine && st.mode !== 'compvscomp';
    r.done.hidden = !show;
    r.done.disabled = !show;
  }

  // ------------------------------------------------------------ camera zoom and pan (R2.19)
  cam = { zoom: 1, x: 0, y: 0 };
  getCamera() {
    const v = this.view?.getView?.();
    const vis = v?.visible;
    return {
      ...this.cam, panX: this.cam.x, panY: this.cam.y,
      scale: v?.scale, minScale: v?.coverScale, maxScale: v ? v.coverScale * v.maxZoom : undefined,
      view: vis ? { x: vis.x0, y: vis.y0, width: vis.x1 - vis.x0, height: vis.y1 - vis.y0 } : undefined,
      detail: v,
    };
  }
  getArena() {
    const d = this.view?.arenaDetails?.();
    if (!d) return null;
    const bd = (this.r.board as El).getBoundingClientRect();
    const dragCard = this.dragKind;
    const highlights: any[] = [];
    const hs = getHighlights(), pf = this.game.state.players.player.faction;
    for (const [k, el] of this.r.cells as Map<string, El>) {
      const kind = el.classList.contains('glow-attack') ? 'attack' : el.classList.contains('glow-swap') ? 'swap' : el.classList.contains('glow-mine') ? 'mine' : el.classList.contains('glow') ? (dragCard === 'spell' ? 'target' : dragCard ? 'summon' : 'move') : null;
      if (!kind) continue;
      const [row, col] = k.split(',').map(Number);
      const c = this.view!.squareCenter(row, col);
      if (c) highlights.push({ kind, row, col, color: kind === 'attack' ? hs.attackColor : edgeOf(pf), glowColor: kind === 'attack' ? hs.attackColor : glowOf(pf), style: 'edge-glow', edgeAlpha: Math.min(1, 0.55 + hs.strength * 0.45), centerAlpha: (hs.fill / 100) * hs.strength, fillAlpha: hs.fill / 100, strength: hs.strength, glow: true, glowSize: hs.glowSize, edgeThickness: hs.edgeThickness, center: { x: c.x + bd.left, y: c.y + bd.top } });
    }
    return { ...d, highlights };
  }
  dragKind = '';
  selectedUid: string | null = null;
  /** Test hook: the four screen corners (CSS px) of a board square. */
  squareQuad(row: number, col: number) {
    const q = this.view?.cellQuad(row, col);
    if (!q || !q.length) return null;
    const bd = (this.r.board as El).getBoundingClientRect();
    return q.map((p: any) => ({ x: p.x + bd.left, y: p.y + bd.top }));
  }
  squareToScreen(row: number, col: number) {
    const c = this.view?.squareCenter(row, col);
    if (!c) return null;
    const bd = (this.r.board as El).getBoundingClientRect();
    return { x: c.x + bd.left, y: c.y + bd.top };
  }
  enemyCrystalKey = '';
  enemyCrystalLeft = 0;
  placeEnemyCrystal() {
    const hud = this.r.board?.isConnected ? (document.querySelector('.crystal-hud.theirs') as HTMLElement | null) : null;
    const rc: any = this.view?.screenRects();
    if (!hud || !rc || !rc.opponentCommander.width) return;
    const W = window.innerWidth, o = rc.opponentCommander;
    const w = hud.getBoundingClientRect().width || 0;
    void w;
    // the HUD is fixed to the screen: it follows the enemy Commander of the home view only, never zooming or panning
    const key = `${W}x${window.innerHeight}`;
    if (this.enemyCrystalKey !== key) { this.enemyCrystalKey = key; this.enemyCrystalLeft = Math.max(W * 0.4, Math.min(W * 0.67, o.x - 6)); }
    const left = this.enemyCrystalLeft;
    hud.style.left = `${(left / W) * 100}%`;
  }
  screenRects() { return this.view ? this.view.screenRects() : null; }
  layoutQueued = false;
  handRoom = Infinity;
  /** Round 12a: size the hand so that, raised, it sits entirely below the player's home row (never covering the board). */
  fitHand() {
    const m = this.root.querySelector('.match') as El | null;
    if (!m || !this.view) return;
    const key = window.innerWidth + 'x' + window.innerHeight;
    // sized once per window shape, from the home view, so zooming or panning the board never resizes the hand
    if (this.handKey === key && m.style.getPropertyValue('--hcw')) return;
    if (this.handKey !== key && this.cam && this.cam.zoom && Math.abs(this.cam.zoom - 1) > 0.01 && this.handKey) return;
    const bb = (this.r.board as El).getBoundingClientRect();
    let bottom = 0;
    for (let col = 1; col <= BW; col++) { const rc = this.view.cellRect(BH, col); bottom = Math.max(bottom, bb.top + rc.y + rc.h); }
    const vh = window.innerHeight, base = Math.min(vh, window.innerWidth * 0.5625) * 0.2455;
    this.handKey = key;
    // phones (very short windows) keep the big owner-size hand; everywhere else the raised hand, with its hovered card, stays below the home row
    this.handRoom = Infinity; // Round 14: the owner's layout wins: hovered card pops to ~1.6x
    const fit = (vh - bottom - 6) / (1.4861 * 1.15);
    if (vh < 500) { m.style.setProperty('--hcw', Math.round(base) + 'px'); return; }
    if (!(fit > 0)) { m.style.setProperty('--hcw', Math.round(base) + 'px'); return; }
    m.style.setProperty('--hcw', Math.round(Math.max(base * 0.97, Math.min(base, fit))) + 'px');
  }
  layoutSoon() { if (this.layoutQueued) return; this.layoutQueued = true; requestAnimationFrame(() => { this.layoutQueued = false; this.layout(); }); }
  syncCam() { const v = this.view?.getView?.(); if (v && v.zoom) this.cam = { zoom: v.zoom, x: ((v.home?.[0] ?? v.painting.w / 2) - v.centerX) * v.scale, y: ((v.home?.[1] ?? v.painting.h / 2) - v.centerY) * v.scale }; }
  applyCam() { this.syncCam(); this.layout(); }
  resetCam() { this.view?.recenter(); this.applyCam(); }
  zoomBy(f: number, sx?: number, sy?: number) { this.view?.zoomAt(f, sx, sy); this.applyCam(); }
  panBy(dx: number, dy: number) { this.view?.panBy(dx, dy); this.applyCam(); }
  startPan(e: PointerEvent) {
    let lx = e.clientX, ly = e.clientY, moved = false;
    const x0 = e.clientX, y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      if (this.touches.size >= 2) return;
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 5) { moved = true; lx = x0; ly = y0; }
      if (moved) { this.panBy(ev.clientX - lx, ev.clientY - ly); lx = ev.clientX; ly = ev.clientY; }
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (!moved) {
        const now = Date.now();
        if (now - this.lastGround < 350) { this.resetCam(); this.lastGround = 0; } else this.lastGround = now;
      }
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  }
  lastGround = 0;
  touches = new Map<number, { x: number; y: number }>();
  setupCamera() {
    const b = this.r.board as El;
    (b.parentElement as El).addEventListener('wheel', (e: WheelEvent) => {
      if ((e.target as El).closest?.('.hand,.dialog,.hud,.reveal')) return;
      e.preventDefault();
      this.noHand = true; clearTimeout((this as any)._nh); (this as any)._nh = setTimeout(() => { if (!this.lastPtr.down) this.noHand = false; }, 350);
      const rc = b.getBoundingClientRect();
      // a mouse wheel (or a trackpad pinch) zooms toward the cursor; a trackpad two-finger scroll pans
      const wheel = e.ctrlKey || e.deltaMode !== 0 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 40);
      if (wheel) this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : e.deltaMode ? 0.05 : 0.0004)), e.clientX - rc.left, e.clientY - rc.top);
      else this.panBy(-e.deltaX, -e.deltaY);
    }, { passive: false });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.pointerType === 'mouse') { if (e.button === 2 && this.unitAtEvent(e)) { e.preventDefault(); return; } if (e.button === 1 || e.button === 2) { e.preventDefault(); this.startPan(e); } return; }
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        const pts = [...this.touches.values()];
        let d0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), mx0 = (pts[0].x + pts[1].x) / 2, my0 = (pts[0].y + pts[1].y) / 2;
        const move = (ev: PointerEvent) => {
          if (!this.touches.has(ev.pointerId)) return;
          this.touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
          const q = [...this.touches.values()];
          if (q.length < 2) return;
          const d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y), mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2;
          const rc = b.getBoundingClientRect();
          this.view?.zoomAt(d / (d0 || 1), mx - rc.left, my - rc.top);
          this.view?.panBy(mx - mx0, my - my0);
          d0 = d; mx0 = mx; my0 = my;
          this.applyCam();
        };
        const end = (ev: PointerEvent) => { this.touches.delete(ev.pointerId); if (this.touches.size < 2) { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); } };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end);
      }
    }, true);
    const rm = (e: PointerEvent) => this.touches.delete(e.pointerId);
    b.addEventListener('pointerup', rm); b.addEventListener('pointercancel', rm);
    // arrow keys and WASD pan the view
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.r.board?.isConnected || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (document.querySelector('.dialog')) return;
      const k = e.key.toLowerCase(), step = 60;
      const d: Record<string, [number, number]> = { arrowleft: [step, 0], a: [step, 0], arrowright: [-step, 0], d: [-step, 0], arrowup: [0, step], w: [0, step], arrowdown: [0, -step], s: [0, -step] };
      if (!d[k]) return;
      e.preventDefault();
      this.panBy(d[k][0], d[k][1]);
    });
  }

  layout() {
    const r = this.r;
    if (!r.board || !this.view) return;
    this.view.resize();
    for (const [k, el] of r.cells as Map<string, El>) {
      const [row, col] = k.split(',').map(Number);
      this.place(el, row, col);
    }
    r.sites.forEach((m: El) => this.place(m, +m.dataset.row!, +m.dataset.col!));
    this.fitHand();
    r.rings.forEach((m: El, i: number) => {
      const col = +m.dataset.col!, row = +m.dataset.row!;
      const a = this.view.cellRect(row - 1, col - 1), b = this.view.cellRect(row + 1, col + 1), c = this.view.cellRect(row - 1, col + 1), d = this.view.cellRect(row + 1, col - 1);
      const x0 = Math.min(a.x, d.x), x1 = Math.max(c.x + c.w, b.x + b.w), y0 = Math.min(a.y, c.y), y1 = Math.max(b.y + b.h, d.y + d.h);
      m.style.left = x0 + 'px'; m.style.top = y0 + 'px'; m.style.width = x1 - x0 + 'px'; m.style.height = y1 - y0 + 'px';
      const f = r.flows[i] as El;
      f.style.left = (x0 + x1) / 2 + 'px'; f.style.top = y0 + 'px';
      // the whole mine site (crystal, pick icon, banner, base) is clickable: the model's screen box, padded a little
      const cr = this.view.cellRect(row, col), hit = r.hits[i] as El;
      const padX = cr.w * 0.25, up = cr.h * 1.5;
      const mb = this.view.mineBox?.(row, col), sm = r.sites[i] as El;
      void mb;
      // round 11: the click area is only the mine's own square (its screen quad), so units standing behind the mine stay selectable
      { const q = this.view.cellQuad(row, col), xs = q.map((p: any) => p.x), ys = q.map((p: any) => p.y), qx = Math.min(...xs), qy = Math.min(...ys);
        sm.style.minWidth = '0'; sm.style.minHeight = '0'; sm.style.left = qx + 'px'; sm.style.top = qy + 'px'; sm.style.width = Math.max(...xs) - qx + 'px'; sm.style.height = Math.max(...ys) - qy + 'px'; sm.style.alignItems = 'center';
        sm.style.clipPath = `polygon(${q.map((p: any) => `${(p.x - qx).toFixed(1)}px ${(p.y - qy).toFixed(1)}px`).join(',')})`; }
      hit.style.left = cr.x - padX + 'px'; hit.style.top = cr.y - up + 'px'; hit.style.width = cr.w + padX * 2 + 'px'; hit.style.height = cr.h + up + cr.h * 0.1 + 'px';
    });
    this.place(r.strong.player, SH.player.row, SH.player.col);
    this.place(r.strong.opponent, SH.opponent.row, SH.opponent.col);
    for (const el of this.tokens.values()) this.placeToken(el, +el.dataset.row!, +el.dataset.col!);
    this.fitHearts();
    this.layoutHand();
  }
  /** Heart on the Stronghold's wall facing the camera (bottom of its cell), shrunk so it never covers a creature label. */
  placeHeart(el: El, side: 'player' | 'opponent') {
    const sh = SH[side];
    const rc = this.view!.cellRect(sh.row, sh.col);
    const s = Math.max(28, Math.min(54, rc.w * 0.8, rc.h * 1.05));
    el.dataset.size = String(s);
    el.style.width = s + 'px'; el.style.height = s + 'px';
    el.style.left = rc.x + rc.w / 2 - s / 2 + 'px';
    el.style.top = rc.y + rc.h - s - 1 + 'px';
    el.style.fontSize = Math.max(14, s * 0.4) + 'px';
  }
  fitHearts() {
    const r = this.r;
    if (!r.board || !this.view || !r.myHealth) return;
    this.placeHeart(r.myHealth, 'player');
    this.placeHeart(r.enemyHealth, 'opponent');
    const labels = [...this.tokens.values()].flatMap((t) => [(t.querySelector('.tk-stats') as El).getBoundingClientRect(), t.getBoundingClientRect()]);
    for (const el of [r.myHealth, r.enemyHealth] as El[]) {
      for (let i = 0; i < 12; i++) {
        const hb = el.getBoundingClientRect();
        if (!labels.some((l) => l.width && hb.left < l.right && hb.right > l.left && hb.top < l.bottom && hb.bottom > l.top)) break;
        const w = el.offsetWidth - 3;
        if (w < 26) break;
        el.style.width = el.style.height = w + 'px';
        el.style.left = el.offsetLeft + 1.5 + 'px';
        el.style.top = el.offsetTop + 3 + 'px';
      }
    }
  }
  /** Token boxes are a narrow strip around the figure, so Commander hearts on neighbouring Strongholds never sit under them. */
  placeToken(el: El, row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    const w = rc.w * 0.5, th = Math.min(rc.h, Math.max(30, rc.h * 0.88));
    el.style.left = rc.x + (rc.w - w) / 2 + 'px'; el.style.top = rc.y + (rc.h - th) + 'px'; el.style.width = w + 'px'; el.style.height = th + 'px';
  }
  place(el: El, row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    // far-row tap targets are a little bigger than they look
    const w = el.classList.contains('cell') ? Math.max(rc.w, 38) : rc.w, hh = el.classList.contains('cell') ? Math.max(rc.h, 34) : rc.h;
    el.style.left = rc.x - (w - rc.w) / 2 + 'px'; el.style.top = rc.y - (hh - rc.h) / 2 + 'px'; el.style.width = w + 'px'; el.style.height = hh + 'px';
    // highlights follow the painted square exactly (its perspective quad), not its bounding box; only lit squares need the
    // clip (a clip-path on every one of the 91 squares makes every pan expensive to paint)
    if (el.classList.contains('cell') && /\b(glow|glow-attack|glow-swap|glow-mine|hover|recap-hl)\b/.test(el.className)) {
      const q = this.view!.cellQuad(row, col);
      if (q.length === 4) el.style.clipPath = `polygon(${q.map((p) => `${(p.x - (rc.x - (w - rc.w) / 2)).toFixed(1)}px ${(p.y - (rc.y - (hh - rc.h) / 2)).toFixed(1)}px`).join(',')})`;
    }
  }

  handTimer: any = null;
  /** The hand rests tucked half below the screen edge; hovering (or tapping on phones) slides it up. */
  openHand(on: boolean, immediate = false) {
    const hand = this.r.hand as El;
    if (!hand) return;
    if (!on && immediate) { clearTimeout(this.handTimer); this.handTimer = null; hand.classList.remove('open'); return; }
    if (on && this.pick && !this.pick.unit && !this.lastPtr.down) return; // tap-to-place: the raised hand must not cover the target squares
    if (on) { clearTimeout(this.handTimer); this.handTimer = null; hand.classList.remove('tuck'); hand.classList.add('open'); }
    else if (!this.handTimer) this.handTimer = setTimeout(() => { this.handTimer = null; hand.classList.remove('open'); }, 90);
  }

  /** Pop a hand card out of the fan as a big close-up (about 70 % of the screen height) on the very top layer, kept fully on screen. */
  popCard(el: El, on: boolean) {
    this.installPopSafety();
    if (on && el.classList.contains('popped')) return;
    if (on && this.pick && !this.pick.unit && this.lastPtr.type === 'mouse' && !this.lastPtr.down) return; // tap-to-place: hovering the hand must not cover the board
    if (on) this.clearPops(el);
    if (!on) {
      // remember where the enlarged card was: a press there right after the hand lowers still grabs that card
      const cl = (el as any)._clone as El | null;
      if (cl && cl.isConnected) { const r = cl.getBoundingClientRect(); this.lastPop = { uid: el.dataset.uid || '', l: r.left, t: r.top, r: r.right, b: r.bottom, at: performance.now() }; }
      (el as any)._ph?.remove(); (el as any)._clone?.remove();
      (el as any)._ph = (el as any)._clone = null;
      el.classList.remove('popped');
      el.style.removeProperty('--gs');
      const hd = this.r.hand as El;
      if (hd && !hd.querySelector('.hand-card.popped:not(.popclone)')) { hd.classList.remove('has-pop'); hd.querySelectorAll('.popclone,.pop-ph').forEach((x) => x.remove()); }
      el.style.translate = ''; el.style.scale = '';
      if (el.dataset.fanAngle0 !== undefined) { el.dataset.fanAngle = el.dataset.fanAngle0; delete el.dataset.fanAngle0; }
      el.style.transform = el.dataset.fan || '';
      el.style.zIndex = el.dataset.z || '';
      this.asideNeighbors(null);
      return;
    }
    if (el.classList.contains('dragging') || el.classList.contains('offhand')) return;
    {
      // round 10: the hand rests a quarter showing; hovering it raises it first, then a hovered card enlarges
      const hd0 = this.r.hand as El;
      if (hd0 && !this.test && !hd0.classList.contains('open')) {
        this.openHand(true);
        setTimeout(() => {
          if (!el.isConnected || !hd0.classList.contains('open') || el.classList.contains('popped')) return;
          if (this.lastPtr.type === 'mouse' && this.hitCard(this.lastPtr.x, this.lastPtr.y) !== el) return;
          this.popCard(el, true);
        }, 280);
        return;
      }
    }
    const host = this.root.querySelector('.match') as El;
    if (!host) return;
    el.dataset.fan = el.dataset.fan || el.style.transform;
    el.dataset.z = el.style.zIndex;
    const hr = host.getBoundingClientRect();
    const hand = this.r.hand as El;
    const w = el.offsetWidth, hgt = el.offsetHeight;
    // the hand is animating up; measure from its un-transformed layout box plus the final (open) offset
    const ty = new DOMMatrix(getComputedStyle(hand).transform).m42;
    // measure the hand at its final raised position (no transition) so the popped card lands where the raised hand will be
    const hadPop = hand.classList.contains('has-pop');
    hand.style.setProperty('transition', 'none', 'important'); hand.classList.add('has-pop'); void hand.offsetHeight;
    const hb = hand.getBoundingClientRect();
    hand.style.removeProperty('transition'); if (!hadPop) hand.classList.remove('has-pop'); void hand.offsetHeight;
    const openY = -0.03 * w;
    const left = hb.left + (parseFloat(el.style.left) || 0);
    void ty; void openY;
    const top = hb.top + (el.offsetTop || 0);
    const S = Math.max(1, Math.min(1.6, (hr.height - 8) / hgt, (hr.width - 8) / w, this.handRoom / hgt));
    const cx = left + w / 2, cy = top + hgt / 2;
    const halfW = (w * S) / 2, halfH = (hgt * S) / 2;
    const targetX = Math.max(hr.left + halfW + 2, Math.min(hr.right - halfW - 2, cx));
    const targetY = Math.max(hr.bottom, window.innerHeight) - halfH - 1;
    el.classList.add('popped');
    if (el.dataset.fanAngle0 === undefined) el.dataset.fanAngle0 = el.dataset.fanAngle || '0';
    el.dataset.fanAngle = '0';
    hand.classList.add('has-pop');
    this.asideNeighbors(el);
    // The popped card ignores the pointer; a transparent proxy keeps its resting spot clickable and draggable.
    const ph = h('span', { class: 'pop-ph', 'aria-hidden': 'true' }) as El;
    ph.style.cssText = `position:absolute;left:${el.style.left};top:${el.offsetTop}px;width:${w}px;height:${hgt}px;transform:${el.dataset.fan || ''};z-index:${el.dataset.z || 1};pointer-events:auto;cursor:grab`;
    ph.addEventListener('pointerdown', (e: PointerEvent) => { if (e.pointerType !== 'mouse') this.openHand(true); }, true);
    ph.addEventListener('pointerdown', (e: PointerEvent) => (el as any)._down?.(e));
    (el as any)._ph = ph;
    hand.append(ph);
    // Only the top ~77 % of the popped card takes the pointer (clip-path), so the fan's other cards stay hoverable below it;
    // a pointer-less copy paints the clipped lower part.
    const clone = el.cloneNode(true) as El;
    clone.classList.add('popclone');
    clone.removeAttribute('aria-label'); clone.removeAttribute('data-card-id'); clone.removeAttribute('data-card'); clone.removeAttribute('data-uid');
    clone.setAttribute('aria-hidden', 'true'); clone.tabIndex = -1;
    clone.querySelectorAll('[data-card-id]').forEach((x: El) => x.removeAttribute('data-card-id'));
    (el as any)._clone = clone;
    hand.append(clone);
    el.style.zIndex = '9000';
    el.style.setProperty('--gs', String(S));
    // translate leads (fast) and the growth follows (slow), so the card never hangs below the screen edge mid-flight
    el.style.transform = 'none';
    el.style.translate = `${targetX - cx}px ${targetY - cy}px`;
    el.style.scale = String(S);
    {
      // land the popped card's bottom on the screen edge (measured with transitions off, so the fan/hand offsets are exact)
      el.style.setProperty('transition', 'none', 'important'); void el.offsetHeight;
      const r = el.getBoundingClientRect();
      const dy = (window.innerHeight - 1) - r.bottom, dx = Math.max(hr.left + 2 - r.left, Math.min(hr.right - 2 - r.right, 0));
      el.style.translate = `${targetX - cx + dx}px ${targetY - cy + dy}px`;
      void el.offsetHeight; el.style.removeProperty('transition');
    }
    const cl = (el as any)._clone as El;
    if (cl) { cl.style.cssText = el.style.cssText; cl.style.zIndex = '8999'; }
    this.watchPop(el);
  }

  /** Test hook: glow state of every card in the player's hand, in hand order. */
  getHandGlow() {
    const st = this.game.state;
    const me = st?.players?.player;
    if (!me) return [];
    return me.hand.map((hc: any) => {
      const c = CARDS[hc.cardId];
      const el = this.r.hand?.querySelector(`[data-uid="${hc.uid}"]`) as El | null;
      const g = el?.querySelector('[data-card-glow]') as El | null;
      const glowing = !!g && getComputedStyle(g).display !== 'none';
      let t = 0;
      if (el && g && glowing) { const a = el.getBoundingClientRect(), b = g.getBoundingClientRect(); t = Math.round(((a.left - b.left) + (b.right - a.right) + (a.top - b.top) + (b.bottom - a.bottom)) / 4 * 10) / 10; }
      return { uid: hc.uid, cardId: hc.cardId, faction: c.faction === 'any' ? 'shared' : c.faction, glowing, popped: !!el?.classList.contains('popped'), thicknessPx: t, opacity: glowing ? GLOW_PEAK : 0, profile: GLOW_PROFILE.map((k) => (glowing ? Math.round(GLOW_PEAK * k * 1000) / 1000 : 0)), color: GLOW_COLOR[c.faction] || GLOW_COLOR.any };
    });
  }

  popWatch: ((e: PointerEvent) => void) | null = null;
  lastPtr = { x: -1, y: -1, type: 'mouse', down: false };
  popSafety = false;
  /** Which fan card (by its resting box, not its popped one) the point is over. */
  hitCard(x: number, y: number): El | null {
    if (this.noHand) return null;
    // the enlarged (popped) card is part of its hover zone: moving up onto it to grab it never retracts it
    const pop = this.r?.hand?.querySelector('.hand-card.popped:not(.popclone)') as El | null;
    // a card's own resting box wins (so moving across the fan switches cards even under the enlarged one) ...
    let hit: El | null = null;
    for (const b of this.handBoxes()) if (x >= b.l && x <= b.l + b.w && y >= b.t && y <= b.t + b.h) hit = b.c;
    if (hit) return hit;
    // ... and the area of the enlarged card above the fan stays part of its zone
    // owner (Oct 25): moving off the fan (even onto the enlarged card) slides the hand back down
    void pop;
    return null;
  }
  noHand = false;
  lastPop: { uid: string; l: number; t: number; r: number; b: number; at: number } | null = null;
  /** Tight hover boxes: only the visible part of each fan card (tucked), or the whole card while the hand is raised. */
  handBoxes(): { c: El; l: number; t: number; w: number; h: number }[] {
    const hand = this.r?.hand as El;
    if (!hand) return [];
    const cards = [...hand.querySelectorAll('.hand-card:not(.popclone)')].filter((c) => !c.classList.contains('offhand')) as El[];
    const vh = window.innerHeight, vw = window.innerWidth;
    const out = [];
    for (const c of cards) {
      // the resting box: a popped card is measured by its placeholder (the fan spot it left)
      const src = ((c as any)._ph as El | undefined)?.isConnected ? (c as any)._ph as El : c;
      const r = src.getBoundingClientRect();
      const l = Math.max(0, r.left), t = r.top, rr = Math.min(vw, r.right), bb = Math.min(vh, r.bottom);
      if (rr > l && bb > t) out.push({ c, l, t, w: rr - l, h: bb - t });
    }
    return out;
  }
  /** Test hook: union box of the hand's hover boxes. */
  getHandHoverBox() {
    const bs = this.handBoxes();
    if (!bs.length) return null;
    const l = Math.min(...bs.map((x) => x.l)), t = Math.min(...bs.map((x) => x.t));
    const r = Math.max(...bs.map((x) => x.l + x.w)), bt = Math.max(...bs.map((x) => x.t + x.h));
    return { left: l, top: t, width: r - l, height: bt - t, cards: bs.length, raised: !!(this.r?.hand as El)?.classList.contains('open') };
  }
  /** Test hook: hover box and the union of the hand cards' visible rectangles (window CSS px). */
  getHandHover() {
    const hand = this.r?.hand as El;
    const rects = hand ? ([...hand.querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[]).map((c) => c.getBoundingClientRect()) : [];
    const W = window.innerWidth, H = window.innerHeight;
    const clipped = rects.map((r) => ({ l: Math.max(0, r.left), t: Math.max(0, r.top), r: Math.min(W, r.right), b: Math.min(H, r.bottom) })).filter((r) => r.r > r.l && r.b > r.t);
    const raised = !!hand && (hand.classList.contains('open') || hand.classList.contains('has-pop'));
    const fan = hand ? ([...hand.querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[]).map((c) => {
      const r = c.getBoundingClientRect();
      const m = new DOMMatrix(getComputedStyle(c).transform === 'none' ? undefined : getComputedStyle(c).transform);
      const sc = parseFloat(getComputedStyle(c).scale) || 1;
      // the card's slot centre: undo the displacement the rotation about the card's pivot adds to the centre
      const [ox, oy] = getComputedStyle(c).transformOrigin.split(' ').map(parseFloat);
      const mx = c.offsetWidth / 2 - ox, my = c.offsetHeight / 2 - oy;
      const dx = (m.a - 1) * mx + m.c * my, dy = m.b * mx + (m.d - 1) * my;
      return { cardId: c.dataset.cardId || (c.querySelector('[data-card-id]') as El | null)?.dataset.cardId || '', cx: r.left + r.width / 2 - dx, cy: r.top + r.height / 2 - dy, width: c.offsetWidth, height: c.offsetHeight,
        rotateDeg: Math.round(Math.atan2(m.b, m.a) * 18000 / Math.PI) / 100, scale: Math.round(Math.hypot(m.a, m.b) * sc * 1000) / 1000 };
    }) : [];
    if (!clipped.length) return { raised, zone: { x: 0, y: 0, width: 0, height: 0 }, cards: { x: 0, y: 0, width: 0, height: 0 }, raisedIndex: -1, popScale: 1.6, popMs: 450, fan };
    const l = Math.min(...clipped.map((r) => r.l)), t = Math.min(...clipped.map((r) => r.t)), r = Math.max(...clipped.map((x) => x.r)), b = Math.max(...clipped.map((x) => x.b));
    const box = { x: l, y: t, width: r - l, height: b - t };
    const raisedIndex = ([...hand.querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[]).findIndex((c) => c.classList.contains('popped'));
    return { raised, zone: box, cards: { ...box }, raisedIndex, popScale: 1.6, popMs: 450, fan };
  }
  /** Return every popped card to the fan and tuck the hand; nothing may stay raised. */
  clearPops(except?: El) {
    const hand = this.r?.hand as El;
    if (!hand) return;
    hand.querySelectorAll('.hand-card.popped:not(.popclone)').forEach((c) => { if (c !== except) this.popCard(c as El, false); });
    if (!except) { hand.classList.remove('has-pop'); hand.querySelectorAll('.popclone,.pop-ph').forEach((x) => x.remove()); }
  }
  installPopSafety() {
    if (this.popSafety) return;
    this.popSafety = true;
    const retract = () => { this.clearPops(); this.openHand(false, true); };
    // a native image drag would cancel the pointer stream mid-drag and strand a card drag
    // R26.A2: the first click/tap of a visit asks the browser for real full screen (once; refusals are ignored)
    if (!(window as any).__ohFsAsked) {
      const fs = () => { if ((window as any).__ohFsAsked) return; (window as any).__ohFsAsked = true; document.removeEventListener('pointerdown', fs, true); document.removeEventListener('click', fs, true); try { const p: any = document.documentElement.requestFullscreen?.(); p && p.catch && p.catch(() => {}); } catch { /* refused */ } };
      document.addEventListener('pointerdown', fs, true); document.addEventListener('click', fs, true);
    }
    document.addEventListener('dragstart', (e) => { if ((e.target as Element)?.closest?.('.hand, .hand-card, .popclone, .dragged-card')) e.preventDefault(); }, true);
    document.addEventListener('pointermove', (e) => { this.lastPtr = { x: e.clientX, y: e.clientY, type: e.pointerType, down: this.lastPtr.down }; }, true);
    document.addEventListener('pointerdown', (e) => {
      this.lastPtr = { x: e.clientX, y: e.clientY, type: e.pointerType, down: true };
      const onHand = !!(e.target as Element)?.closest?.('.hand, .hand-card, .hand-scroll');
      // tap-to-place: a tucked hand card resting over a lit square must not swallow the tap on that square
      if (onHand && this.pick && !this.pick.unit && e.pointerType === 'mouse' && e.button === 0) {
        const cell = this.cellAt(e.clientX, e.clientY);
        const p = cell && this.pick.cells.find((c) => c.row === cell.row && c.col === cell.col);
        if (p) { e.stopPropagation(); e.preventDefault(); this.pick.done(p); return; }
      }
      this.noHand = !onHand;
      const lp = this.lastPop;
      if (this.noHand && lp && !this.dialogs.length && !(e.target as Element)?.closest?.('.overlay, .cardzoom, [role=dialog]') && e.pointerType === 'mouse' && e.button === 0 && performance.now() - lp.at < 1500 && e.clientX >= lp.l && e.clientX <= lp.r && e.clientY >= lp.t && e.clientY <= lp.b) {
        const hc = this.game.state?.players?.player?.hand?.find((k: any) => k.uid === lp.uid);
        const cardEl = this.r?.hand?.querySelector(`.hand-card[data-uid="${lp.uid}"]:not(.popclone)`) as El | null;
        if (hc && cardEl) { this.noHand = false; this.lastPop = null; this.cardPointerDown(e, hc, cardEl); return; }
      }
      if (this.noHand) { this.clearPops(); this.openHand(false, true); }
    }, true);
    const up = () => { this.lastPtr.down = false; this.noHand = false; if (this.lastPtr.type !== 'mouse') retract(); };
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
    window.addEventListener('blur', retract);
    document.documentElement.addEventListener('mouseleave', retract);
    document.addEventListener('visibilitychange', retract);
    setInterval(() => {
      const hand = this.r?.hand as El;
      if (!hand || !hand.isConnected) return;
      const cur = hand.querySelector('.hand-card.popped:not(.popclone)') as El;
      if (!cur) {
        const orphan = hand.querySelector('.popclone,.pop-ph'); if (orphan) this.clearPops();
        // a mouse that has left the hand area tucks it back (nothing may stay raised)
        if (hand.classList.contains('open') && this.lastPtr.type === 'mouse' && !this.root.querySelector('.hand-card.dragging')) {
          const bx = this.getHandHoverBox(), { x, y } = this.lastPtr;
          if (!bx || !(x >= bx.left - 6 && x <= bx.left + bx.width + 6 && y >= bx.top - 6 && y <= bx.top + bx.height + 6)) this.openHand(false, true);
        }
        // a resting mouse over a card that never got its hover event (the card moved under it) still pops that card
        if (this.lastPtr.type === 'mouse' && this.lastPtr.x >= 0 && !this.lastPtr.down && !this.root.querySelector('.hand-card.dragging')) {
          const hit = this.hitCard(this.lastPtr.x, this.lastPtr.y);
          if (hit && this.root.querySelector('.match')) { this.openHand(true); this.popCard(hit, true); }
        }
        return;
      }
      if (this.lastPtr.type === 'mouse') { if (this.hitCard(this.lastPtr.x, this.lastPtr.y) !== cur && !cur.classList.contains('dragging') && !cur.matches(':focus-visible')) retract(); }
      else if (!this.lastPtr.down) retract();
    }, 80);
  }
  watchPop(first: El) {
    if (this.popWatch) document.removeEventListener('pointermove', this.popWatch);
    const fn = (e: PointerEvent) => {
      const hand = this.r.hand as El;
      const cur = this.root.querySelector('.hand-card.popped:not(.popclone)') as El;
      if (!hand || !cur || !cur.isConnected) { document.removeEventListener('pointermove', fn); if (this.popWatch === fn) this.popWatch = null; return; }
      if (e.pointerType !== 'mouse') return;
      const hit = this.hitCard(e.clientX, e.clientY);
      if (hit === cur) return;
      this.popCard(cur, false);
      if (hit) this.popCard(hit, true); else { document.removeEventListener('pointermove', fn); this.popWatch = null; this.openHand(false, true); }
    };
    this.popWatch = fn;
    document.addEventListener('pointermove', fn);
  }

  /** The fan shows about 7 cards in a fixed width; more cards scroll (R3.7). */
  layoutHand() {
    const hand = this.r.hand as El;
    if (!hand) return;
    this.installPopSafety();
    const cards = [...hand.querySelectorAll('.hand-card:not(.popclone)')] as El[];
    const n = cards.length;
    const VIS = 8;
    // Off-hand cards wait in an invisible clipped strip; if anything scrolls one into view (focus, assistive tech) the fan follows.
    let spill = hand.querySelector('.hand-spill') as El;
    if (!spill) {
      spill = h('div', { class: 'hand-spill', 'aria-hidden': 'false' }) as El;
      spill.addEventListener('scroll', () => {
        if (!spill.scrollLeft) return;
        const sr = spill.getBoundingClientRect();
        const all = [...hand.querySelectorAll('.hand-card:not(.popclone)')] as El[];
        const idx = all.findIndex((c) => { if (c.parentElement !== spill) return false; const b = c.getBoundingClientRect(); const m = b.left + b.width / 2; return m >= sr.left && m <= sr.right; });
        spill.scrollLeft = 0;
        if (idx >= 0) { this.handScroll = idx - 3; this.layoutHand(); }
      });
      hand.append(spill);
    }
    const cw = cards[0]?.offsetWidth || 66;
    const W = hand.clientWidth || cw * 4;
    const maxScroll = Math.max(0, n - VIS);
    this.handScroll = Math.max(0, Math.min(maxScroll, this.handScroll));
    const start = Math.round(this.handScroll);
    const shown = Math.min(n, VIS);
    const HD0 = (ownerLayoutHand as any) || {};
    const ch = cards[0]?.offsetHeight || cw * 1.4;
    // owner layout editor (R23.1): neighbours sit overlap × card width apart; only shrink when the fan would not fit the hand box
    const spacing = shown > 1 ? Math.min(cw * (HD0.overlap ?? 0.26), (W - cw) / (shown - 1)) : cw;
    const x0 = Math.max(0, (W - (cw + (shown - 1) * spacing)) / 2);
    let moved = false;
    cards.forEach((c, i) => {
      const k = i - start;
      if (k < 0 || k >= VIS) {
        c.classList.add('offhand'); c.style.left = W + 20 + (i + 1) * (cw + 10) + 'px'; c.style.transform = ''; c.dataset.fan = ''; c.tabIndex = -1;
        if (c.parentElement !== spill) spill.append(c);
        return;
      }
      if (c.parentElement === spill) { hand.append(c); moved = true; }
      c.classList.remove('offhand'); c.tabIndex = 0;
      const off = k - (shown - 1) / 2;
      const t = (off * spacing) / (W / 2);
      const HD = (ownerLayoutHand as any) || {};
      const rot = off * (HD.angle ?? 4);
      void t;
      const y = off * off * ch * (HD.arc ?? 1.45) / 100;
      c.dataset.fanAngle = String(Math.round(rot * 100) / 100);
      c.style.left = x0 + k * spacing + 'px';
      c.style.transform = `translateY(${y}px) rotate(${rot}deg)`;
      c.dataset.fan = c.style.transform;
      c.style.zIndex = String(k + 1);
      c.dataset.z = String(k + 1);
    });
    if (moved) for (const c of cards) if (c.parentElement === hand) hand.append(c);
    if (hand.lastElementChild !== spill) hand.append(spill);
    const hl = this.r.handLeft as El, hr = this.r.handRight as El;
    if (hl) { hl.hidden = !(n > VIS && start > 0); hr.hidden = !(n > VIS && start < maxScroll); }
    hand.classList.toggle('more-left', start > 0);
    hand.classList.toggle('more-right', n > VIS && start < maxScroll);
  }

  update(st: any, events: any[]) {
    const r = this.r;
    if (!r.board || !st) return;
    const me = st.players.player, en = st.players.opponent;
    this.view && this.view.setState(st, events);
    this.record(st, events);
    this.logFx(st, events);
    this.setHeart(r.enemyHealth, en.health);
    this.placeEnemyCrystal();
    this.setHeart(r.myHealth, me.health);
    (r.enemyDeck.querySelector('.pile-n') as El).textContent = String(en.deck.length);
    (r.myDeck.querySelector('.pile-n') as El).textContent = String(me.deck.length);
    r.enemyDeck.style.setProperty('--fill', String(Math.max(0.55, Math.min(1, 0.55 + en.deck.length / 60))));
    r.myDeck.style.setProperty('--fill', String(Math.max(0.55, Math.min(1, 0.55 + me.deck.length / 60))));
    r.enemyHand.classList.toggle('browsing', st.activePlayer === 'opponent' && st.phase !== 'over' && st.phase !== 'mulligan');
    r.crFlow.textContent = String(me.crystals);
    r.crBank.textContent = String(me.bank);
    r.eFlow.textContent = String(en.crystals);
    r.eBank.textContent = String(en.bank);
    this.setCmdName(r.myName, COMMANDERS[me.commanderId]?.name || '');
    this.setCmdName(r.eName, COMMANDERS[en.commanderId]?.name || '');
    r.income.textContent = `Next +${st.phase === 'mulligan' ? 0 : incomePreview(st, 'player')}`;
    r.eNext.textContent = `Next +${st.phase === 'mulligan' ? 0 : incomePreview(st, 'opponent')}`;
    const pm = `${me.crystals}|${en.crystals}`;
    if (this.flowKey !== pm && this.flowKey !== '' && st.turn !== this.flowTurn) { this.view?.pulseFlow(st.activePlayer); this.flowPulses[st.activePlayer]++; }
    { const m = this.root.querySelector('.match'); this.view?.setFlowTarget?.('player', m?.querySelector('[data-role=player-flow-crystal]') as El | null); this.view?.setFlowTarget?.('opponent', m?.querySelector('[data-role=enemy-flow-crystal]') as El | null); }
    this.cmdBehavior(st);
    if (st.turn !== this.flowTurn) { this.flowTurn = st.turn; { this.view?.pulseFlow(st.activePlayer); this.flowPulses[st.activePlayer]++; } }
    this.flowKey = pm;
    // enemy hand arc
    const n = en.hand.length;
    r.enemyHand.replaceChildren();
    const shown = Math.min(n, 6);
    for (let i = 0; i < shown; i++) {
      const ang = (i - (shown - 1) / 2) * 9;
      const b = h('div', { class: 'back', 'data-card-back': '', 'data-fan-angle': String(ang), 'aria-hidden': 'true' });
      b.style.transform = `rotate(${ang}deg)`;
      b.append(ohBackEl());
      r.enemyHand.append(b);
    }
    // phase
    const whose = st.activePlayer === 'player' ? 'Your turn' : 'Enemy turn';
    r.phase.dataset.side = st.activePlayer === 'player' ? 'you' : 'enemy';
    (r.phase.querySelector('.ph-turn') as El).textContent = st.phase === 'mulligan' ? 'Mulligan' : st.phase === 'over' ? 'Match over' : `${whose} · Turn ${st.turn}`;
    r.phase.querySelectorAll('.ph-step').forEach((el: El) => {
      const order = ['draw', 'deploy', 'action', 'end'], k = el.dataset.phase!, cur = order.indexOf(st.phase);
      const here = st.phase === k;
      if (here) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      el.classList.toggle('done', cur > order.indexOf(k) && cur >= 0);
    });
    const key = `${st.turn}|${st.phase}|${st.priority}|${st.pendingResponse ? 1 : 0}`;
    if (key !== this.phaseKey) {
      const phaseChanged = !this.phaseKey || key.split('|').slice(0, 2).join() !== this.phaseKey.split('|').slice(0, 2).join();
      this.phaseKey = key;
      if (phaseChanged) {
        this.deadline = Date.now() + CONFIG.phaseTimerSeconds * 1000;
        this.testLeft = null;
        this.movesDlg && this.movesDlg.close();
        this.movesDlg = null; this.closeDropUp();
        this.swapping = false;
        this.queueBanners(st);
      }
    }
    const mine = st.priority === 'player' && st.activePlayer === 'player' && ACTIVE.includes(st.phase) && !st.pendingResponse;
    this.syncDone();
    const canSwap = mine && st.phase === 'deploy' && this.game.legalActions().some((a: any) => a.type === 'gathererSwap');
    r.swap.hidden = !canSwap;
    if (!canSwap) this.swapping = false;
    // board overlays
    this.renderTip(st);
    this.renderSites(st);
    this.renderTokens(st);
    this.renderHand(st);
    this.handleDialogs(st);
    this.animate(st, events);
    this.prevCreatures = st.board.creatures.map((c: any) => ({ uid: c.uid, cardId: c.cardId, row: c.row, col: c.col }));
    this.tick();
  }

  // ------------------------------------------------------------ enemy turn recap (R9.7)
  prevCreatures: any[] = [];
  enemyLog: { text: string; cardId: string; row: number; col: number }[] = [];
  recording = false;
  record(st: any, events: any[]) {
    if (events.some((e) => e.type === 'newMatch')) { this.enemyLog = []; this.recording = false; this.prevCreatures = []; return; }
    const find = (uid: string) => this.prevCreatures.find((c) => c.uid === uid) || st.board.creatures.find((c: any) => c.uid === uid);
    const swapMates = new Set(events.filter((e) => e.type === 'swap').map((e) => e.withUid));
    for (const e of events) {
      if (e.type === 'turnStart') {
        for (const site of st.sites as any[]) {
          if (site.controller !== e.player) continue;
          const mine = e.player === 'player';
          this.flowLog.push({ side: e.player, from: { row: site.row, col: site.col }, to: mine ? 'player-flow-crystal' : 'enemy-flow-crystal', shards: 'faceted', sBends: 2, flow: st.players[e.player].flow, count: flowShardCount(st.players[e.player].flow), colors: [FACTION_GLOW[this.game.state.players[e.player as 'player'].faction], GLOW_COLOR[this.game.state.players[e.player as 'player'].faction]], toScreen: (() => { const t = this.root.querySelector(`[data-role=${mine ? 'player' : 'enemy'}-flow-crystal]`) as El | null; const b = t?.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; })(), at: performance.now() });
        }
        if (e.player === 'opponent') { this.enemyLog = []; this.recording = true; } else this.recording = false;
        continue;
      }
      if (!this.recording) continue;
      if (e.type === 'summon' && e.owner === 'opponent') this.enemyLog.push({ text: `Summoned ${CARDS[e.cardId].name}`, cardId: e.cardId, row: e.row, col: e.col });
      else if (e.type === 'move' && !swapMates.has(e.uid)) {
        const cr = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (cr && cr.owner === 'opponent') this.enemyLog.push({ text: `Moved ${CARDS[cr.cardId].name}`, cardId: cr.cardId, row: e.to.row, col: e.to.col });
      } else if (e.type === 'attack') {
        const a = find(e.uid);
        if (!a || !this.prevCreatures.some((c) => c.uid === e.uid)) continue;
        const att = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (att && att.owner === 'player') continue;
        let tn = 'your Commander', pos: any = SH.player;
        if (e.target.row) { const d = this.prevCreatures.find((c) => c.row === e.target.row && c.col === e.target.col); tn = d ? CARDS[d.cardId].name : 'a creature'; pos = e.target; }
        this.enemyLog.push({ text: `${CARDS[a.cardId].name} attacked ${tn}`, cardId: a.cardId, row: pos.row, col: pos.col });
      } else if (e.type === 'cast' && e.player === 'opponent') this.enemyLog.push({ text: `Cast ${CARDS[e.cardId].name}`, cardId: e.cardId, row: SH.opponent.row, col: SH.opponent.col });
      else if (e.type === 'playCrystal' && e.player === 'opponent') this.enemyLog.push({ text: `Played ${CARDS[e.cardId].name}`, cardId: e.cardId, row: SH.opponent.row, col: SH.opponent.col });
      else if (e.type === 'mine') {
        const cr = st.board.creatures.find((c: any) => c.uid === e.uid);
        if (cr && cr.owner === 'opponent') this.enemyLog.push({ text: `Mined +${e.amount}`, cardId: cr.cardId, row: e.row, col: e.col });
      }
    }
  }
  showLastTurn() {
    const lines = this.enemyLog.map((l) => {
      const c = CARDS[l.cardId];
      return h('li', {}, h('button', { type: 'button', class: 'recap-line', onclick: () => this.highlight(l.row, l.col) },
        h('span', { class: `mini f-${c?.faction}`, 'aria-hidden': 'true', 'data-sym': c?.type === 'creature' ? (isMiner(c) ? '⛏️' : '⚔️') : c?.type === 'spell' ? '✨' : '💎' }), l.text));
    });
    const d: any = this.dialog('Last turn', [h('h2', {}, 'Last turn'),
      lines.length ? h('ul', { class: 'recap' }, ...lines) : h('p', { style: 'text-align:center' }, 'Nothing yet.'),
      h('div', { class: 'row' }, btn('Close', 'primary', () => d.close()))]);
  }
  highlight(row: number, col: number) {
    const el = this.r.cells?.get(row + ',' + col) as El | undefined;
    if (!el) return;
    el.classList.add('recap-hl');
    setTimeout(() => el.classList.remove('recap-hl'), 1600);
  }


  setHeart(el: El, n: number) {
    el.textContent = String(n);
    el.dataset.low = String(n <= 7);
  }

  // ------------------------------------------------------------ banners
  bannerQ: string[] = [];
  bannerEl: El | null = null;
  bannerAt = 0;
  queueBanners(st: any) {
    if (st.phase !== 'deploy' && st.phase !== 'action') return;
    const skipped = this.game.autoSkip && !hasMovesLeft(st);
    if (st.activePlayer !== 'player') { if (st.phase === 'deploy') this.bannerQ.push('ENEMY TURN'); return; }
    if (st.phase === 'deploy') this.bannerQ.push('YOUR TURN');
    if (!skipped) this.bannerQ.push(st.phase === 'deploy' ? 'DEPLOY' : 'ACTION');
  }
  pumpBanner() {
    const r = this.r;
    if (!r.board) return;
    const now = Date.now();
    if (this.bannerEl) {
      const life = this.bannerQ.length ? 450 : 1500;
      if (now - this.bannerAt < life) return;
      this.bannerEl.remove();
      this.bannerEl = null;
    }
    if (!this.bannerQ.length) return;
    const blocked = this.dialogs.length > 0 || !(r.timer as El).hidden;
    if (blocked) return;
    const text = this.bannerQ.shift()!;
    // Owner (Oct 24): phase banners are the owner's pictures; the words stay as hidden text
    const BANNER_PIC: Record<string, string> = { 'YOUR TURN': 'your-turn', 'ENEMY TURN': 'opponents-turn', DEPLOY: 'deploy', ACTION: 'action' };
    const pic = BANNER_PIC[text];
    this.bannerEl = pic
      ? h('div', { class: 'banner banner-img', role: 'status', 'aria-label': 'Phase banner', 'data-banner': pic }, h('img', { src: `/art/ui/banner-${pic}.webp`, alt: '', draggable: 'false' }), h('span', { class: 'sr-only' }, text))
      : h('div', { class: 'banner', role: 'status', 'aria-label': 'Phase banner' }, text);
    this.root.querySelector('.match')?.append(this.bannerEl);
    this.bannerAt = now;
  }

  // ------------------------------------------------------------ Done, Miner swap, site info
  movesDlg: { close: () => void } | null = null;
  swapping = false;
  get remindMoves() { return localStorage.getItem('oreheart.movesReminder') !== 'off'; }
  tuckOutside = (e: PointerEvent) => {
    const hand = this.r.hand as El | undefined;
    if (hand && e.pointerType !== 'mouse' && !hand.contains(e.target as Node)) { clearTimeout(this.handTimer); hand.classList.remove('open'); }
  };
  onKey = (_e: KeyboardEvent) => { /* no keyboard shortcuts */ };

  // ------------------------------------------------------------ callouts, reveals and spell effects
  revealSeconds() { return localStorage.getItem('oreheart.reveal') === 'fast' ? CONFIG.revealFastSeconds : CONFIG.revealSeconds; }
  callout(player: string, cardId: string) {
    if (!this.r.fx) return;
    const sh = SH[player as 'player' | 'opponent'];
    const p = this.center(sh.row, sh.col);
    const id = this.game.state.players[player].commanderId;
    const f = h('div', { class: 'callout ' + player, role: 'status' }, `${shortName(id)} CASTS ${CARDS[cardId].name.toUpperCase()}!`);
    f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1700);
  }
  /** Big card in the middle of the screen, then it drops onto its space (or flies away). */
  reveals: { player: El[]; opponent: El[] } = { player: [], opponent: [] };
  reveal(cardId: string, at?: { row: number; col: number } | null, side: 'player' | 'opponent' = 'player') {
    if ((this.test && !this.fxReal) || !this.r.board) return;
    if (side === 'player') return; // round 11: only the opponent's played cards pop up
    const c = CARDS[cardId];
    const secs = this.revealSeconds();
    const el = h('div', { class: `reveal hand-card static ${c.type} f-${c.faction}`, role: 'group', 'aria-label': 'Card reveal', 'data-card-id': c.id, 'data-frame': frameKey(c), 'data-rarity': rarityKey(c) }, ...faceKids(c));
    const host = this.root.querySelector('.match') as El;
    // round 10: enemy plays hover at the left edge, yours at the right edge; up to 3 stack (newest on top, offset)
    const list = this.reveals[side];
    const hostR = host.getBoundingClientRect(), vh = window.innerHeight, vw = window.innerWidth;
    const cw = Math.min(180, vh * 0.3);
    while (list.length >= 3) list.shift()!.remove();
    el.style.setProperty('--cw', cw + 'px');
    el.dataset.side = side; el.dataset.slot = String(list.length);
    const place = () => {
      list.forEach((r, i) => {
        const k = list.length - 1 - i; // 0 = newest, on top
        r.dataset.slot = String(i); r.dataset.stackIndex = String(k);
        r.style.left = (side === 'opponent' ? 10 + cw / 2 + k * 22 : vw - 8 - cw / 2 - k * 22) - hostR.left + 'px';
        r.style.top = vh * 0.42 - k * 16 - hostR.top + 'px';
        r.style.zIndex = String(520 + i);
      });
    };
    list.push(el); place();
    host.append(el);
    let done = false;
    const unlist = () => { const i = list.indexOf(el); if (i >= 0) { list.splice(i, 1); place(); } };
    const finish = () => {
      if (done) return; done = true; unlist();
      let dx = 0, dy = 0;
      if (at && this.view) {
        const pc = this.center(at.row, at.col);
        const br = this.r.board.getBoundingClientRect(), hr = host.getBoundingClientRect(), er = el.getBoundingClientRect();
        dx = br.left - hr.left + pc.x - (er.left - hr.left + er.width / 2);
        dy = br.top - hr.top + pc.y - (er.top - hr.top + er.height / 2);
      }
      if (c.type === 'creature' && at && this.view) {
        // drop onto the space, flip, glow, then rise into the 3D creature with a dust puff
        const T = (x: number, y: number, sc: number, ry: number) => `translate(calc(-50% + ${x}px),calc(-50% + ${y}px)) perspective(600px) rotateY(${ry}deg) scale(${sc})`;
        const gl = '0 0 40px #ffd45aaa,0 10px 30px #000', glow = '0 0 70px 22px #fff2a0,0 0 30px 10px #ffd45a';
        const dur = Math.min(1500, secs * 1000);
        const anim = el.animate([
          { transform: T(0, 0, 1, 0), opacity: 1, boxShadow: gl, offset: 0 },
          { transform: T(dx, dy, 0.42, 0), opacity: 1, boxShadow: gl, offset: 0.35 },
          { transform: T(dx, dy, 0.42, 180), opacity: 1, boxShadow: glow, offset: 0.6 },
          { transform: T(dx, dy, 0.42, 360), opacity: 1, boxShadow: glow, offset: 0.75 },
          { transform: T(dx, dy - 40, 0.18, 360), opacity: 0, boxShadow: glow, offset: 1 },
        ], { duration: dur, easing: 'ease-in-out', fill: 'forwards' });
        const puff = h('div', { class: 'dust-puff', 'aria-hidden': 'true' });
        const pc = this.center(at.row, at.col);
        puff.style.left = `${pc.x}px`; puff.style.top = `${pc.y}px`;
        setTimeout(() => this.r.board?.append(puff), dur * 0.8);
        setTimeout(() => puff.remove(), dur * 0.8 + 700);
        anim.onfinish = () => el.remove();
        return;
      }
      const anim = el.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.15)`, opacity: 0.2 }], { duration: Math.min(500, secs * 700), easing: 'ease-in', fill: 'forwards' });
      anim.onfinish = () => el.remove();
    };
    // tap pins the card so it stays readable while play continues; tap again dismisses it
    let timer: any = null;
    el.addEventListener('pointerdown', (ev: Event) => {
      ev.stopPropagation();
      if (el.dataset.pinned === 'true') { done = true; unlist(); el.remove(); return; }
      if (done) return;
      clearTimeout(timer);
      el.dataset.pinned = 'true';
    });
    timer = setTimeout(finish, secs * 1000);
  }
  spellFx(e: any) {
    if (!this.r.fx || !this.view) return;
    const card = CARDS[e.cardId];
    const sh = SH[e.player as 'player' | 'opponent'];
    const t = e.target && e.target.row ? e.target : e.target && e.target.commander ? SH[e.target.commander as 'player' | 'opponent'] : null;
    const spawn = (cls: string, text: string, row: number, col: number, ms = 1100) => {
      const p = this.center(row, col);
      const f = h('div', { class: 'fx-' + cls, 'aria-hidden': 'true' }, text);
      f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
      this.r.fx.append(f);
      setTimeout(() => f.remove(), ms);
    };
    const v = SPELL_VISUALS[e.cardId];
    if (!v) return;
    const target = t || SH[e.player === 'player' ? 'opponent' : 'player'];
    const from = this.center(sh.row, sh.col);
    const at = v.fly ? this.center(target.row, target.col) : this.center((t || sh).row, (t || sh).col);
    // step 1: the card flies out of the caster's Stronghold
    const chip = h('div', { class: 'fxv-card', 'aria-hidden': 'true' }, v.glyph);
    chip.style.left = from.x + 'px'; chip.style.top = from.y + 'px';
    this.r.fx.append(chip);
    requestAnimationFrame(() => { chip.style.left = (v.fly ? at.x : from.x) + 'px'; chip.style.top = (v.fly ? at.y : from.y - 30) + 'px'; chip.classList.add('go'); });
    // step 2: it turns into the effect; step 3: the result lands
    setTimeout(() => {
      chip.remove();
      const f = h('div', { class: `fxv fxv-${v.id}`, 'data-visual': v.id, 'aria-hidden': 'true' }, h('span', { class: 'fxv-g' }, v.glyph), h('span', { class: 'fxv-g2' }, v.glyph), h('span', { class: 'fxv-g3' }, v.glyph));
      const pt = at;
      f.style.left = pt.x + 'px'; f.style.top = pt.y + 'px';
      this.r.fx.append(f);
      if (e.cardId === 'meteor-strike') { this.r.board.classList.remove('shake'); void this.r.board.offsetWidth; this.r.board.classList.add('shake'); setTimeout(() => this.r.board.classList.remove('shake'), 800); }
      setTimeout(() => {
        const r = h('div', { class: 'fxv-result', 'aria-hidden': 'true' }, v.land);
        r.style.left = pt.x + 'px'; r.style.top = pt.y + 'px';
        this.r.fx.append(r);
        setTimeout(() => r.remove(), 1100);
      }, 320);
      setTimeout(() => f.remove(), v.ms);
    }, v.fly ? 650 : 450);
  }
  shatter(player: string) {
    const sh = SH[player === 'player' ? 'opponent' : 'player'];
    const p = this.center(sh.row, sh.col);
    for (let i = 0; i < 8; i++) {
      const f = h('div', { class: 'fx-shard', 'aria-hidden': 'true' });
      f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
      f.style.setProperty('--a', String(i * 45));
      this.r.fx.append(f);
      setTimeout(() => f.remove(), 1000);
    }
  }

  /** R26.A6: Done ends the phase silently after any move; with none made (and moves left) a drop-up asks first. */
  dropUp: El | null = null;
  closeDropUp() { this.dropUp?.remove(); this.dropUp = null; }
  pressDone() {
    const st = this.game.state;
    if (!st) return;
    if (this.dropUp) { this.closeDropUp(); return; }
    if (this.movesDlg) return;
    if (this.remindMoves && !movedThisPhase(st) && hasMovesLeft(st)) {
      const txt = "Moves still available (miners haven't mined). Continue to the next phase?";
      const up: El = h('div', { class: 'menu-panel done-dropup', role: 'dialog', 'aria-label': 'Moves still available' },
        h('p', { class: 'dropup-text' }, txt),
        h('div', { class: 'row' }, btn('Continue', 'primary', () => { this.closeDropUp(); this.game.act({ type: 'done' }); }), btn('Go back', '', () => this.closeDropUp())));
      const db = this.r.done as El, bb = db.getBoundingClientRect();
      up.style.left = Math.max(4, Math.min(window.innerWidth - 4 - 340, bb.left + bb.width / 2 - 170)) + 'px';
      up.style.bottom = (window.innerHeight - bb.top + 4) + 'px';
      document.body.append(up);
      this.dropUp = up;
      const off = (e: Event) => { if (!up.contains(e.target as Node) && e.target !== db && !db.contains(e.target as Node)) { this.closeDropUp(); document.removeEventListener('pointerdown', off, true); } };
      document.addEventListener('pointerdown', off, true);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeDropUp(); }, { once: true });
    } else this.game.act({ type: 'done' });
  }
  startSwap() {
    const acts = this.game.legalActions().filter((a: any) => a.type === 'gathererSwap');
    if (!acts.length) return;
    if (!acts[0].discardUid) { this.game.act(acts[0]); return; }
    this.swapping = true;
    this.flash('Tap the card you want to discard');
  }
  holdTimer: any = null;
  holdFired = false;
  siteTip: El | null = null;
  siteTipMode = '';
  closeSiteTip() { this.siteTip?.remove(); this.siteTip = null; this.siteTipMode = ''; }
  /** Tap a mine: all ready Miners next to it mine; with none ready it shows the info instead. */
  tapSite(i: number) {
    if (this.holdFired) { this.holdFired = false; return; }
    const m = this.r.sites[i] as El;
    if (+(m.dataset.readyMiners || 0) > 0) {
      this.closeSiteTip();
      const s = this.game.state.sites[i];
      this.game.act({ type: 'mineAt', row: s.row, col: s.col });
      return;
    }
    this.openSite(i, 'tap');
  }
  openSite(i: number, mode = 'tap') {
    const st = this.game.state;
    if (!st) return;
    this.closeSiteTip();
    const s = st.sites[i];
    const who = s.controller === 'player' ? 'You' : s.controller === 'opponent' ? 'Enemy' : 'Nobody';
    const color = s.color.charAt(0).toUpperCase() + s.color.slice(1);
    const line = (t: string) => h('p', { style: 'text-align:center;margin:2px 0' }, t);
    const tip = h('div', { class: 'site-tip', role: 'dialog', 'aria-label': 'Crystal site' }, h('h2', {}, 'Crystal site'), line(`Controlled by: ${who}`), line(`Color: ${color}`),
      line(`Your flow: +${s.flow.player}`), line(`Enemy flow: +${s.flow.opponent}`));
    if (mode !== 'hover') tip.append(btn('Close', 'small', () => this.closeSiteTip()));
    const m = this.r.sites[i] as El;
    const rr = this.root.getBoundingClientRect(), mr = m.getBoundingClientRect();
    tip.style.left = `${Math.max(4, Math.min(rr.width - 190, mr.left - rr.left + mr.width / 2 - 90))}px`;
    tip.style.bottom = `${Math.max(4, rr.bottom - mr.top + 6)}px`;
    this.root.append(tip);
    this.siteTip = tip; this.siteTipMode = mode;
    if (mode !== 'hover') {
      const off = (e: Event) => { if (!tip.contains(e.target as Node)) { this.closeSiteTip(); document.removeEventListener('pointerdown', off, true); } };
      setTimeout(() => document.addEventListener('pointerdown', off, true), 0);
    }
  }

  // ------------------------------------------------------------ timer
  testLeft: number | null = null;
  lastTick = Date.now();
  timedNow(st: any) {
    return !st.tutorial && st.mode !== 'compvscomp' && !(st.mode === 'cardplay' && st.phase === 'action') && st.priority === 'player' && st.activePlayer === 'player' && ACTIVE.includes(st.phase);
  }
  setPhaseTimeLeft(n: number) {
    const st = this.game.state;
    if (!st) return;
    n = Math.max(0, +n || 0);
    if (n <= 0) { if (st.priority === st.activePlayer && ACTIVE.includes(st.phase) && !st.pendingResponse) this.game.act({ type: 'done' }); return; }
    this.testLeft = n;
    this.deadline = Date.now() + n * 1000;
    this.tick();
  }
  tick() {
    const st = this.game.state, r = this.r;
    const now = Date.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    if (!st || !r.timer) return;
    if (st.pendingResponse || this.game.paused) this.deadline += dt;
    const timed = this.timedNow(st);
    const total = CONFIG.phaseTimerSeconds;
    const frozen = this.test;
    const left = frozen ? (this.testLeft ?? total) : Math.max(0, Math.ceil((this.deadline - now) / 1000));
    const show = timed && left <= CONFIG.countdownSeconds && !st.pendingResponse;
    r.timer.hidden = !show;
    const pt = r.phase?.querySelector('.ph-time') as El | null;
    if (pt) pt.textContent = timed && !st.pendingResponse ? `${left}s left` : '';
    this.syncDone();
    if (show) { if (r.timer.textContent !== String(left)) audio.play('tick'); r.timer.textContent = String(left); }
    if (!frozen && timed && left <= 0 && !st.pendingResponse) {
      this.deadline = now + total * 1000;
      this.game.act({ type: 'done' });
    }
  }

  renderTip(st: any) {
    const tip = this.r.tip as El;
    if (!st.tutorial) { tip.hidden = true; return; }
    const step = st.tutorial.step;
    tip.hidden = false;
    tip.dataset.step = step;
    tip.replaceChildren(h('div', { class: 'tip-text' }, (tutorialJson as any).tips[step] || ''),
      btn('Skip Tutorial', 'tip-skip', () => this.showMenu()));
  }

  renderSites(st: any) {
    st.sites.forEach((s: any, i: number) => {
      const m = this.r.sites[i] as El;
      const fac = s.controller ? st.players[s.controller].faction : '';
      const emb = fac ? mineEmblemUrl(fac) : null;
      const mkEmb = () => (emb ? h('img', { class: 'mine-emblem', 'data-mine-emblem': fac, alt: '', draggable: 'false', src: emb }) : '');
      const myAction = st.phase === 'action' && st.priority === 'player' && st.activePlayer === 'player' && !st.pendingResponse;
      const n = myAction ? readyMinersAt(st, 'player', s).length : 0;
      m.dataset.readyMiners = String(n);
      m.classList.toggle('ready', n > 0);
      const mk = (n > 0 ? `x${n}` : 'o') + ':' + fac;
      if (m.dataset.mk !== mk) {
        m.dataset.mk = mk;
        if (n > 0) m.replaceChildren(h('span', { class: 'pickaxe', 'data-mine-badge': '', 'aria-hidden': 'true' }, h('i', { class: 'pk-h' }), h('i', { class: 'pk-head' }), h('i', { class: 'pk-spark' })), mkEmb(), `×${n}`);
        else m.replaceChildren(...(this.view?.is3D ? [] : ['💎']), mkEmb());
      }
      m.style.color = COLOR_HEX[s.color] || COLOR_HEX.white;
      const ring = this.r.rings[i] as El;
      ring.style.setProperty('--mine', s.controller ? FACTION_GLOW[this.game.state.players[s.controller].faction] : COLOR_HEX[s.color] || COLOR_HEX.white);
      this.r.flows[i].textContent = `+${s.flow.player} / +${s.flow.opponent}`;
    });
    this.fitMineBadges();
  }
  /** R26.A5: keep every pickaxe badge fully inside the window. */
  fitMineBadges() {
    requestAnimationFrame(() => {
      for (const b of this.root.querySelectorAll('[data-mine-badge]') as any as El[]) {
        b.style.translate = '';
        const r = b.getBoundingClientRect(); if (!r.width) continue;
        const pad = 4;
        const dx = r.left < pad ? pad - r.left : r.right > window.innerWidth - pad ? window.innerWidth - pad - r.right : 0;
        const dy = r.top < pad ? pad - r.top : r.bottom > window.innerHeight - pad ? window.innerHeight - pad - r.bottom : 0;
        if (dx || dy) b.style.translate = `${dx}px ${dy}px`;
      }
    });
  }

  renderTokens(st: any) {
    const seen = new Set<string>();
    for (const c of st.board.creatures) {
      seen.add(c.uid);
      const card = CARDS[c.cardId];
      let el = this.tokens.get(c.uid);
      if (!el) {
        el = h('div', { class: `token f-${card.faction} ${c.owner === 'player' ? 'mine' : 'theirs'}`, role: 'img' },
          h('div', { class: 'tk-body', 'data-sym': FSYM(card.faction), 'aria-hidden': 'true' }),
          h('div', { class: 'tk-stats' }, h('div', { 'data-unit-badge': '', 'data-metal': METAL[card.faction] || 'gold', 'data-type': isMiner(card) ? 'pickaxe' : card.abilities?.includes('ranged') ? 'bow' : 'sword', role: 'img' },
            h('img', { class: 'ub-frame', alt: '', draggable: 'false', src: `/art/ui/badges/frame-${METAL[card.faction] || 'gold'}.webp` }),
            h('img', { class: 'ub-icon', alt: '', draggable: 'false', src: `/art/ui/badges/icon-${isMiner(card) ? 'pickaxe' : card.abilities?.includes('ranged') ? 'bow' : 'sword'}-${METAL[card.faction] || 'gold'}.webp` }),
            h('span', { class: 'ub-n ub-h', 'data-stat': 'health', 'aria-hidden': 'true' }), h('span', { class: 'ub-n ub-a', 'data-stat': 'attack', 'aria-hidden': 'true' }), h('span', { class: 'ub-n ub-m', 'data-stat': 'movement', 'aria-hidden': 'true' })), h('span', { class: 'a' }), ' ', h('span', { class: 'h' }), ' ', h('span', { class: 'm' }), h('span', { class: 'sh' })), h('div', { class: 'pips', 'aria-hidden': 'true' }));
        this.tokens.set(c.uid, el);
        this.r.board.insertBefore(el, this.r.fx);
      }
      el.dataset.uid = c.uid; el.dataset.row = String(c.row); el.dataset.col = String(c.col);
      const printed: any = CARDS[c.cardId];
      const atkNow = c.attack + junkBonus(st, c);
      const aEl = el.querySelector('.a') as El, hEl = el.querySelector('.h') as El, mEl = el.querySelector('.m') as El;
      aEl.textContent = String(atkNow); aEl.dataset.buff = String(atkNow > printed.attack);
      hEl.textContent = String(c.health); hEl.dataset.buff = String(c.health > printed.health);
      mEl.textContent = String(maxMove(c));
      { const bd = el.querySelector('[data-unit-badge]') as El, sv = (k: string, v: number, buff: boolean) => { const n = bd.querySelector(`[data-stat=${k}]`) as El; if (n.textContent !== String(v)) n.textContent = String(v); n.dataset.buff = String(buff); };
        sv('attack', atkNow, atkNow > printed.attack); sv('health', c.health, c.health > printed.health); sv('movement', maxMove(c), false);
        bd.dataset.damaged = String(c.health < c.maxHealth); bd.setAttribute('aria-label', `Attack ${atkNow}, Health ${c.health}, Movement ${maxMove(c)}`); }
      aEl.title = 'Attack'; hEl.title = 'Health'; mEl.title = 'Movement';
      el.dataset.extras = `${isMiner(printed) ? '⛏️' : ''}${printed.abilities?.includes('ranged') ? '🏹' : ''}`;
      el.dataset.mining = String(!!c.minedMine);
      const up = c.upgrades.attack + c.upgrades.health;
      el.dataset.upgrades = String(up);
      (el.querySelector('.pips') as El).textContent = up ? '●'.repeat(Math.min(up, 8)) : '';
      const sh = el.querySelector('.sh') as El;
      // Owner (Oct 24): the pickaxe/bow already shows in the stat badge, so it is no longer drawn again beside it (kept as hidden text for screen readers)
      let ex = el.querySelector('.tk-extra') as El | null;
      if (!ex) { ex = h('span', { class: 'tk-extra sr-only' }) as El; el.append(ex); }
      ex.textContent = el.dataset.extras || '';
      sh.textContent = c.shield > 0 ? `🛡${c.shield}` : '';
      el.dataset.poison = String(c.poison || 0);
      el.dataset.drunk = String(c.drunk || 0);
      el.dataset.facing = String(c.facing || "");
      let pm = el.querySelector('.poison-mark') as El | null;
      if (c.poison > 0) {
        if (!pm) { pm = h('span', { class: 'poison-mark', role: 'img' }); sh.after(pm); }
        pm.setAttribute('aria-label', `Poisoned, ${c.poison} turns left`);
        pm.textContent = `💧${c.poison}`;
      } else if (pm) pm.remove();
      this.renderStatusIcons(st, c, el);
      el.dataset.damaged = String(c.health < c.maxHealth);
      el.dataset.acted = String(isActed(st, c));
      el.setAttribute("aria-label", `${card.name}, row ${c.row}, column ${c.col}`);
      // legacy short-name alias for the renamed Shieldbeard (mirrors the damaged flag and stats)
      let alias = el.querySelector('.alias-label') as El | null;
      if (card.id === 'shieldbeard') {
        if (!alias) { alias = h('span', { class: 'alias-label', 'aria-hidden': 'false' }); el.append(alias); }
        alias.setAttribute('aria-label', `Shieldbeard, row ${c.row}, column ${c.col}`);
        alias.dataset.damaged = el.dataset.damaged;
        alias.textContent = `⚔️${c.attack} ❤️${c.health}`;
      }
      el.title = `${card.name}: Attack ${c.attack}, Health ${c.health}/${c.maxHealth}${c.shield > 0 ? `, Shield ${c.shield}` : ''}${c.poison > 0 ? `, Poisoned for ${c.poison} more turns` : ''}`;
      this.placeToken(el, c.row, c.col);
    }
    for (const [uid, el] of this.tokens) if (!seen.has(uid)) { el.remove(); this.tokens.delete(uid); }
    this.renderAbilityButtons(st);
    this.fitHearts();
  }

  /** Round 13: a small round icon above every unit with an activated ability; lit when it is your turn and the ability can be used. */
  /** Owner (Oct 25): lasting effects show as the owner's icons above the unit's head for as long as they last (with turns left when known). */
  renderStatusIcons(st: any, c: any, el: El) {
    const t = st.turn;
    const list: { k: string; n: number; label: string }[] = [];
    if (c.poison > 0) list.push({ k: 'poison', n: c.poison, label: `Poisoned, ${c.poison} turn${c.poison > 1 ? 's' : ''} left` });
    if (c.drunk > 0) list.push({ k: 'drunk', n: c.drunk, label: `Drunk, ${c.drunk} turn${c.drunk > 1 ? 's' : ''} left` });
    if ((c.rootUntil || 0) > t) list.push({ k: 'rooted', n: c.rootUntil - t, label: "Rooted: can't move" });
    if ((c.wardUntil || 0) > t) list.push({ k: 'ward', n: 0, label: 'Warded: takes no damage' });
    if (c.shield > 0 || c.bubble) list.push({ k: 'shield', n: c.shield > 0 ? c.shield : 0, label: c.shield > 0 ? `Shield ${c.shield}` : 'Shield bubble' });
    if ((c.lockedUntil || 0) > t) list.push({ k: 'sleep', n: c.lockedUntil - t, label: `Can't act for ${c.lockedUntil - t} more turn${c.lockedUntil - t > 1 ? 's' : ''}` });
    let box = el.querySelector('.st-icons') as El | null;
    const key = list.map((x) => x.k + x.n).join(',');
    if (!list.length) { box?.remove(); return; }
    if (!box) { box = h('div', { class: 'st-icons', role: 'group', 'aria-label': 'Status' }) as El; el.append(box); }
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren(...list.map((x) => h('span', { class: 'st-ic', 'data-status': x.k, role: 'img', 'aria-label': x.label, title: x.label },
      h('img', { src: `/art/pop/icon-${x.k}.webp`, alt: '', draggable: 'false' }), x.n > 0 ? h('b', { 'aria-hidden': 'true' }, String(x.n)) : '')));
  }
  renderAbilityButtons(st: any) {
    const live = st.phase !== 'over' && st.phase !== 'mulligan';
    const legal: any[] = [...(live ? brewActions(st, 'player') : []), ...(live && st.priority === 'player' ? this.game.legalActions().filter((a: any) => a.type === 'ability' && (a.ability === 'brew' || (st.activePlayer === 'player' && st.phase === 'action'))) : [])];
    for (const c of st.board.creatures) {
      const el = this.tokens.get(c.uid);
      if (!el) continue;
      const keys = ((CARDS[c.cardId].abilities || []) as string[]).filter((k) => ABILITY_UI[k]);
      el.querySelectorAll('.ab-btn').forEach((b) => { if (!keys.some((k) => (PUB_ABILITY[k] || k) === (b as El).dataset.ability)) b.remove(); });
      keys.forEach((k, i) => {
        const ui = ABILITY_UI[k], cost = k === 'blink' ? 1 : ABILITY_COST[k] || 0;
        let b = el.querySelector(`.ab-btn[data-ability="${PUB_ABILITY[k] || k}"]`) as El | null;
        if (!b) {
          b = h('button', { type: 'button', class: 'ab-btn', 'data-ability': PUB_ABILITY[k] || k, 'data-creature-uid': c.uid }, h('span', { 'aria-hidden': 'true' }, ui.icon)) as El;
          let picking = false;
          // while a target is being chosen the button may sit over a target square: let that press reach the board
          b.addEventListener('pointerdown', (e) => { picking = !!this.pick; if (!picking) e.stopPropagation(); });
          const showTip = () => {
            this.hideAbilityTip();
            const tip = h('div', { role: 'tooltip', class: 'ab-tip', id: 'ab-tip' }, b!.getAttribute('aria-label') || '') as El;
            const r = b!.getBoundingClientRect();
            tip.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${Math.max(4, r.top - 8)}px;transform:translate(-50%,-100%);z-index:9999;max-width:min(320px,90vw);padding:6px 10px;background:#000c;border:1px solid #c9a24b;border-radius:8px;color:#fff;font-size:max(14px,1.6vh);pointer-events:none;text-align:center`;
            document.body.append(tip);
            b!.setAttribute('aria-describedby', 'ab-tip');
          };
          b.addEventListener('pointerenter', showTip); b.addEventListener('focus', showTip);
          b.addEventListener('pointerleave', () => this.hideAbilityTip()); b.addEventListener('blur', () => this.hideAbilityTip());
          b.addEventListener('click', (e) => { e.stopPropagation(); this.hideAbilityTip(); if (picking) { picking = false; return; } const cr = this.game.state.board.creatures.find((x: any) => x.uid === c.uid); if (cr) this.useAbility(cr, k); });
          // Owner (Oct 25): the ability icon takes the place of the unit-type icon in the stat badge
          const bd = el.querySelector('[data-unit-badge]') as El | null;
          (bd || el).append(b);
          if (bd) bd.dataset.ability = PUB_ABILITY[k] || k;
        }
        const mineUnit = c.owner === 'player';
        const ok = mineUnit && legal.some((a: any) => a.creatureUid === c.uid && a.ability === k);
        b.dataset.ready = String(ok); b.dataset.icon = ui.icon;
        b.classList.toggle('off', !ok);
        b.setAttribute('aria-disabled', String(!ok));
        b.style.setProperty('--ox', (i - (keys.length - 1) / 2) * 120 + '%');
        // shimmer only when it can be used right now (your unit, your turn, enough crystals); otherwise it just looks like a normal badge icon
        b.classList.toggle('ready', ok);
        const label = `${CARDS[c.cardId].name}: ${ui.name} (${cost || 'free'}) ${cost ? 'crystal' + (cost > 1 ? 's' : '') + '. ' : '. '}${ui.text}`;
        b.title = label; b.setAttribute('aria-label', label);
      });
    }
  }
  // ---- R26.A9: Junk Shaman lift, the player picks the landing square
  lift: { shamanUid: string; targetUid: string | null; legal: { row: number; col: number }[]; hover: { row: number; col: number } | null; ghost?: El; stop?: () => void } | null = null;
  getLiftState() {
    const l = this.lift;
    if (l) return { active: true, shamanUid: l.shamanUid, targetUid: l.targetUid, legalSquares: l.legal.map((c) => ({ ...c })), hover: l.hover ? { ...l.hover } : null };
    const pk: any = this.pick;
    if (pk && pk.lift) return { active: true, shamanUid: pk.lift as string, targetUid: null, legalSquares: [], hover: null };
    return { active: false, shamanUid: null, targetUid: null, legalSquares: [], hover: null };
  }
  cancelLift(msg = '') {
    const l = this.lift;
    if ((this.pick as any)?.lift) { this.pick = null; this.clearGlow(); }
    if (!l) return;
    l.stop && l.stop();
    this.lift = null; this.clearGlow();
    if (msg) this.flash(msg);
  }
  startLift(cr: any) {
    const st = this.game.state;
    const targets = shamanLiftTargets(st, cr.uid);
    if (!targets.length) { this.flash('Junk Shaman: nobody within 5 spaces to lift'); return; }
    const cells = targets.filter((t: any) => shamanLandingSquares(st, cr.uid, t.uid).length).map((t: any) => ({ row: t.row, col: t.col }));
    if (!cells.length) { this.flash('Junk Shaman: nowhere to land'); return; }
    this.pick = { cells, lift: cr.uid, done: (cell: any) => {
      this.pick = null; this.clearGlow();
      const tgt = st.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col);
      if (tgt) this.beginLandingPick(cr, tgt);
    } } as any;
    this.setGlow(cells, 'glow-swap');
    this.flash('Junk Shaman: choose a character to lift');
  }
  beginLandingPick(cr: any, tgt: any) {
    const st = this.game.state;
    const legal = shamanLandingSquares(st, cr.uid, tgt.uid);
    const l: NonNullable<App['lift']> = { shamanUid: cr.uid, targetUid: tgt.uid, legal, hover: null };
    this.lift = l;
    this.clearGlow();
    this.setGlow(legal, 'glow-swap');
    const card = CARDS[tgt.cardId];
    const ghost = h('div', { class: 'ghost tk lift-ghost', 'aria-hidden': 'true' }, FSYM(card.faction));
    ghost.style.cssText = 'position:fixed;pointer-events:none;z-index:1000;transform:translate(-50%,calc(-50% - 28px));filter:drop-shadow(0 18px 8px #0009)';
    document.body.append(ghost); l.ghost = ghost;
    this.tokens.get(tgt.uid)?.classList.add('lifted');
    const hl = (c: { row: number; col: number } | null) => {
      for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('hover', 'lift-hover');
      l.hover = c;
      if (c) this.r.cells.get(c.row + ',' + c.col)?.classList.add('hover', ...(legal.some((q) => q.row === c.row && q.col === c.col) ? ['lift-hover'] : []));
    };
    const mv = (e: PointerEvent) => { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; hl(this.cellAt(e.clientX, e.clientY)); };
    const down = (e: PointerEvent) => {
      if ((e.target as El)?.closest?.('.dialog,.overlay,.hud-menu,.menu-panel')) return;
      e.preventDefault(); e.stopPropagation();
      if (e.button === 2) { this.cancelLift('Cancelled'); return; }
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const c = this.cellAt(e.clientX, e.clientY);
      if (!c) return;
      if (c.row === cr.row && c.col === cr.col) { this.cancelLift('Cancelled'); return; }
      if (!legal.some((q) => q.row === c.row && q.col === c.col)) return; // illegal square: nothing happens
      const action = shamanLiftAction(this.game.state, cr.uid, tgt.uid, c);
      this.cancelLift();
      this.payGate(2, () => { const r = this.game.act(action); if (r && !r.ok) this.flash(r.error!); });
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); this.cancelLift('Cancelled'); } };
    const ctx = (e: Event) => { e.preventDefault(); this.cancelLift('Cancelled'); };
    document.addEventListener('pointermove', mv, true); document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true); document.addEventListener('contextmenu', ctx, true);
    l.stop = () => {
      document.removeEventListener('pointermove', mv, true); document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true); document.removeEventListener('contextmenu', ctx, true);
      ghost.remove(); this.tokens.get(tgt.uid)?.classList.remove('lifted');
    };
    const p = this.squareToScreen(tgt.row, tgt.col);
    if (p) { ghost.style.left = p.x + 'px'; ghost.style.top = p.y + 'px'; }
    this.flash('Click a lit square to drop it there (Esc cancels)');
  }
  /** Click an ability button: no target = fire; otherwise light up the squares it can go to and wait for a click. */
  hideAbilityTip() { document.getElementById('ab-tip')?.remove(); }
  useAbility(cr: any, k: string) {
    const ui = ABILITY_UI[k];
    if (this.game.state.priority !== 'player' || (this.game.state.phase !== 'action' && k !== 'brew')) { this.flash('Abilities are used in your Action phase'); return; }
    const opts = this.game.legalActions().filter((a: any) => a.type === 'ability' && a.creatureUid === cr.uid && a.ability === k);
    if (!opts.length) { this.flash(`${ui.name}: not available (needs crystals, or already used this turn)`); return; }
    this.pick = null; this.clearGlow();
    if (k === 'shaman') { this.startLift(cr); return; }
    const cellOf = (a: any) => this.abilityCell(a, cr) || a.target || null;
    if (!opts.some(cellOf)) { const r = this.game.act(opts[0]); if (!r.ok) this.flash(r.error!); return; }
    const cells = opts.map(cellOf).filter(Boolean) as { row: number; col: number }[];
    this.pick = { cells, done: (cell) => {
      this.pick = null; this.clearGlow();
      const here = opts.filter((a: any) => { const q = cellOf(a); return q && q.row === cell.row && q.col === cell.col; });
      const a = k === 'shaman' ? this.bestShaman(here, cr) : here[0];
      if (a) { const r = this.game.act(a); if (!r.ok) this.flash(r.error!); }
    } };
    this.setGlow(cells, 'glow-swap');
    this.flash(`${ui.name}: choose a square`);
  }

  renderHand(st: any) {
    const me = st.players.player;
    const hand = this.r.hand as El;
    const tot = funds(me);
    const tunnel = true; // R10.13: Tunnel works any time, next to any mine
    const hidden = st.phase === 'mulligan';
    const costOf = (c: any) => (c.type === 'creature' ? creatureCost(st, 'player', c) : c.type === 'spell' ? spellCost(st, 'player', c) : 0);
    const affordable = (c: any) => (c.type === 'creature' ? tot >= costOf(c) : c.type === 'spell' ? tot >= costOf(c) : true);
    const playableUids = new Set<string>();
    if (!hidden && st.priority === 'player') for (const a of this.game.legalActions() as any[]) if (a.uid && a.type !== 'pass' && a.type !== 'done') playableUids.add(a.uid);
    const key = hidden ? 'x' : me.hand.map((hc: any) => hc.uid + ':' + affordable(CARDS[hc.cardId]) + ':' + costOf(CARDS[hc.cardId]) + ':' + tunnel + ':' + (playableUids.has(hc.uid) ? 1 : 0)).join(',');
    if (key === this.handKey) return;
    this.handKey = key;
    this.clearPops();
    hand.replaceChildren();
    if (hidden) return;
    let dealN = 0;
    for (const hc of me.hand) {
      const c = CARDS[hc.cardId];
      const cost = costOf(c);
      const el = h('button', { type: 'button', class: `hand-card ${c.type} f-${c.faction} ${affordable(c) ? '' : 'unaff'}`, 'aria-label': c.name, 'data-uid': hc.uid, 'data-playable': String(playableUids.has(hc.uid) && affordable(c)), style: `--gc:${GLOW_COLOR[c.faction] || GLOW_COLOR.any}`, 'data-card': c.id, 'data-card-id': c.id, 'data-frame': frameKey(c), 'data-rarity': rarityKey(c) },
        ...faceKids(c, cost),
        c.role === 'Smith' ? h('span', { class: 'smith-banner', 'aria-hidden': 'true' }, 'SMITH') : null,
        playableUids.has(hc.uid) ? h('span', { class: 'card-glow', 'data-card-glow': '', 'aria-hidden': 'true' }) : null,
        tunnel && c.abilities?.includes('tunnel') ? h('span', { class: 'tunnel-tag' }, 'Tunnel!') : null);
      (el.querySelector('.ohcard') || el.firstElementChild)?.setAttribute('data-card-id', c.id);
      el.addEventListener('pointerenter', (e: PointerEvent) => { if (e.pointerType === 'mouse') { if (this.lastPtr.down || this.noHand || el.classList.contains('popped') || this.hitCard(e.clientX, e.clientY) !== el) return; this.openHand(true); this.popCard(el, true); } });
      el.addEventListener('pointerleave', (e: PointerEvent) => { if (e.pointerType !== 'mouse') this.popCard(el, false); });
      el.addEventListener('pointerdown', (e: PointerEvent) => { if (e.pointerType !== 'mouse') this.openHand(true); }, true);
      el.addEventListener('focus', () => { if (el.matches(':focus-visible')) this.popCard(el, true); });
      el.addEventListener('blur', () => this.popCard(el, false));
      el.addEventListener('pointerdown', (e: PointerEvent) => this.cardPointerDown(e, hc, el));
      (el as any)._down = (e: PointerEvent) => this.cardPointerDown(e, hc, el);
      el.addEventListener('click', (e: MouseEvent) => { if (e.detail === 0) this.showCard(c.id); });
      if (!this.seenHand.has(hc.uid)) { this.seenHand.add(hc.uid); const d = dealN++ * 130; el.classList.add('dealt'); el.style.animationDelay = d + 'ms'; this.dealLog.push({ uid: hc.uid, delayMs: d, startMs: performance.now() + d, durationMs: 700 } as any); setTimeout(() => el.classList.remove('dealt'), d + 760); }
      hand.append(el);
    }
    this.layoutHand();
  }
  /** Test hook: every owner-layout piece with its box, plus theme info. */
  getHud() {
    const m = this.root.querySelector('.match') as El | null;
    if (!m) return null;
    const pieces: any = {};
    m.querySelectorAll('[data-role]').forEach((e: El) => { const b = e.getBoundingClientRect(); pieces[e.dataset.role!] = { x: b.left, y: b.top, w: b.width, h: b.height, text: e.textContent, rotation: getComputedStyle(e).rotate, hidden: !!(e as any).hidden }; });
    const ps = this.game.state.players;
    return { width: m.clientWidth, height: m.clientHeight, pieces, themes: { player: { faction: ps.player.faction, hasTheme: hasTheme(ps.player.faction) }, opponent: { faction: ps.opponent.faction, hasTheme: hasTheme(ps.opponent.faction) } },
      bankPictures: { player: (m.querySelector('[data-role=player-bank] img') as HTMLImageElement | null)?.getAttribute('src'), opponent: (m.querySelector('[data-role=enemy-bank] img') as HTMLImageElement | null)?.getAttribute('src') },
      gemPictures: { player: (m.querySelector('[data-role=player-flow-crystal] img') as HTMLImageElement | null)?.getAttribute('src'), opponent: (m.querySelector('[data-role=enemy-flow-crystal] img') as HTMLImageElement | null)?.getAttribute('src') },
      cornerFrames: m.querySelectorAll('.o-frame').length,
      bankBadgeOnCrystal: !!m.querySelector('.o-gem .o-bank-n, .o-gem .cry-bank'),
      menu: { open: m.querySelector('.o-menu')?.classList.contains('open') || false, items: [...m.querySelectorAll('.o-menu-item')].map((x) => x.textContent) } };
  }
  flowLog: any[] = [];
  flowPulses: Record<string, number> = { player: 0, opponent: 0 };
  getFlowStreams() { const now = performance.now(); const strip = ({ at, ...r }: any) => ({ ...r, toPoint: r.toScreen ?? null, pulses: this.flowPulses[r.side] || 0 }); const log = this.flowLog.map(strip); return { active: this.flowLog.filter((f) => now - f.at < 2500).map(strip), log, targets: this.view?.flowDestinations?.() ?? null, pulses: { ...this.flowPulses } }; }
  getDealLog() { return this.dealLog.map((d: any) => ({ uid: d.uid, startMs: d.startMs, durationMs: d.durationMs })); }
  getHudLayout() { const m = this.root.querySelector('.match') as any; return m?._hudInfo ? m._hudInfo() : null; }
  getTheme(side: 'player' | 'opponent') {
    const m = this.root.querySelector('.match') as El | null;
    const f = this.game.state.players[side === 'player' ? 'player' : 'opponent'].faction as string;
    const id = ({ goblins: 'goblin', gnomes: 'gnome', dwarves: 'dwarf' } as any)[f] || f;
    const hudSide = side === 'player' ? 'player' : 'enemy';
    return { faction: id, placeholder: !hasTheme(f),
      crystalSrc: (m?.querySelector(`[data-role=${hudSide}-flow-crystal] img`) as HTMLImageElement | null)?.getAttribute('src') || null,
      bankSrc: (m?.querySelector(`[data-role=${hudSide}-bank] img`) as HTMLImageElement | null)?.getAttribute('src') || null,
      cornerFrames: side === 'player' ? (m?.querySelectorAll('[data-corner-frame]').length || 0) : 0 };
  }
  /** Round 9a: drawn cards slide up from below the screen one after another (700 ms each, 130 ms apart). */
  seenHand = new Set<string>();
  dealLog: { uid: string; delayMs: number; startMs?: number; durationMs: number }[] = [];
  getDealState() { return { log: this.dealLog.slice(-20), dealing: !!this.r.hand?.querySelector('.hand-card.dealt') }; }
  /** The neighbors of the raised card move aside (12 % of a card width). */
  asideNeighbors(el: El | null) {
    const hand = this.r.hand as El;
    if (!hand) return;
    const cards = [...hand.querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[];
    const idx = el ? cards.indexOf(el) : -1;
    cards.forEach((c, i) => {
      if (c === el) return;
      const base = el ? 'translateY(0px)' : c.dataset.fan || ''; // raised hand: the fan's curve is flattened
      c.style.transform = idx < 0 || !el ? base : `${base} translateX(${(i < idx ? -1 : 1) * c.offsetWidth * 0.2 * (1 / Math.max(1, Math.abs(i - idx) * 0.6))}px)`;
      c.dataset.aside = idx < 0 ? '' : i < idx ? 'left' : 'right';
    });
  }

  // ------------------------------------------------------------ dialogs driven by state
  mullDlg: { close: () => void } | null = null;
  respDlg: { close: () => void } | null = null;
  handleDialogs(st: any) {
    const needMull = st.phase === 'mulligan' && st.priority === 'player' && !st.mulliganDone.player;
    if (needMull && this.mullDlg && (this.mullDlg as any).el.dataset.mulligans !== String(st.players.player.mulligans || 0)) { this.mullDlg.close(); this.mullDlg = null; }
    if (needMull && !this.mullDlg) this.openMulligan(st);
    if (!needMull && this.mullDlg) { this.mullDlg.close(); this.mullDlg = null; }
    const needResp = !!st.pendingResponse && st.pendingResponse.responder === 'player' && st.phase !== 'over';
    if (needResp && !this.respDlg && !this.pick) { this.respStart = Date.now(); this.respSig = this.respondSig(st); this.openRespond(st); }
    else if (needResp && this.respDlg && this.respSig !== this.respondSig(st)) {
      // the player's own plays (e.g. a Crystal card) change what is affordable: rebuild the buttons, keep the clock
      this.respSig = this.respondSig(st);
      this.respDlg.close(); this.respDlg = null;
      this.openRespond(st);
    }
    if (!needResp && this.respDlg) { this.respDlg.close(); this.respDlg = null; clearTimeout(this.respondTimer); }
    if (!needResp && this.pick && this.pick.cells.length === 0) this.pick = null;
  }

  openMulligan(st: any) {
    const selected = new Set<string>();
    const hand = st.players.player.hand;
    const wrap = h('div', { class: 'mull-hand', style: `--n:${Math.max(5, hand.length)}` });
    const left = 3 - (st.players.player.mulligans || 0);
    const redraw = btn('Redraw Selected', '', () => go([...selected]), { disabled: true });
    for (const hc of hand) {
      const c = CARDS[hc.cardId];
      const face = h('div', { class: `hand-card static ${c.type} f-${c.faction}`, 'aria-hidden': 'true', 'data-frame': frameKey(c), 'data-rarity': rarityKey(c) }, ...faceKids(c));
      const b = h('button', { type: 'button', class: 'mull-card', 'aria-pressed': 'false', 'aria-label': c.name, 'data-uid': hc.uid, 'data-card-id': c.id, 'data-frame': frameKey(c), 'data-rarity': rarityKey(c), onclick: () => {
        if (selected.has(hc.uid)) selected.delete(hc.uid); else selected.add(hc.uid);
        b.setAttribute('aria-pressed', String(selected.has(hc.uid)));
        (redraw as HTMLButtonElement).disabled = selected.size === 0;
      } }, face);
      wrap.append(b);
    }
    const go = (uids: string[]) => this.game.act({ type: 'mulligan', uids });
    const d = this.dialog('Mulligan', [h('h2', {}, 'Mulligan'), h('p', { class: 'mull-left', style: 'text-align:center;margin:0 0 10px' }, `Mulligans left: ${left}`), h('p', { class: 'mull-hint', style: 'text-align:center;margin:0 0 6px' }, 'Tap cards you want to shuffle back and redraw (your first redraw keeps 5 cards, then 4, then 3).'), wrap,
      h('div', { class: 'row' }, btn('Keep Hand', 'primary', () => go([])), redraw)]);
    d.el.dataset.sticky = '1';
    d.el.dataset.mulligans = String(st.players.player.mulligans || 0);
    this.mullDlg = d;
  }

  respondSig(st: any) {
    return JSON.stringify(this.game.legalActions()) + '|' + st.players.player.crystals + '|' + st.players.player.bank;
  }
  openRespond(st: any) {
    const pend = st.pendingResponse;
    const legalAll = this.game.legalActions();
    const legal = legalAll.filter((a: any) => a.type === 'respond');
    const needs = respondNeeds(st, 'player', pend);
    const tgt = pend.target && pend.target.row ? st.board.creatures.find((c: any) => c.row === pend.target.row && c.col === pend.target.col) : null;
    const tname = tgt ? (tgt.owner === 'player' ? `your ${CARDS[tgt.cardId].name}` : `their ${CARDS[tgt.cardId].name}`) : pend.target && pend.target.commander ? 'your Commander' : '';
    const what = pend.kind === 'summon' ? `Enemy summons ${CARDS[pend.card.cardId].name}.` : pend.kind === 'cast' ? `Enemy casts ${CARDS[pend.card.cardId].name}${tname ? ' at ' + tname : ''}.` : `Enemy attacks ${tname || 'one of your creatures'}.`;
    const buttons: El[] = [];
    const finish = () => { this.respDlg && this.respDlg.close(); this.respDlg = null; clearTimeout(this.respondTimer); };
    for (const n of needs) {
      const card = CARDS[n.cardId];
      const opts = legal.filter((a: any) => a.uid === n.uid);
      if (!opts.length) {
        buttons.push(btn(`${card.name} — need ${n.need} more`, '', undefined, { disabled: true, 'data-uid': n.uid }));
        continue;
      }
      const cr = opts[0].crystalUid ? st.players.player.hand.find((x: any) => x.uid === opts[0].crystalUid) : null;
      const label = cr ? `${CARDS[cr.cardId].name} + ${card.name}` : card.name;
      buttons.push(btn(label, '', () => {
        let chosen = opts[0];
        if (opts.length > 1) {
          const tc = pend.target && pend.target.row ? opts.find((o: any) => o.target && o.target.row === pend.target.row && o.target.col === pend.target.col) : null;
          if (tc) chosen = tc;
          else {
            finish();
            this.pick = { cells: opts.map((o: any) => o.target), done: (cell) => { this.pick = null; this.clearGlow(); this.game.act(opts.find((o: any) => o.target.row === cell.row && o.target.col === cell.col)); } };
            this.setGlow(this.pick.cells, 'glow');
            this.flash('Tap a target');
            return;
          }
        }
        finish();
        this.game.act(chosen);
      }, { 'data-uid': n.uid }));
    }
    for (const a of legalAll.filter((x: any) => x.type === 'playCrystal')) {
      const hc = st.players.player.hand.find((x: any) => x.uid === a.uid);
      if (hc) buttons.push(btn(`Play ${CARDS[hc.cardId].name}`, '', () => { const r = this.game.act(a); if (r && !r.ok) this.flash(r.error); }, { 'data-uid': a.uid }));
    }
    const ec = pend.card ? CARDS[pend.card.cardId] : null;
    if (ec) this.dialogCard = ec.id + pend.actor;
    const cardBox = ec ? h('div', { class: `enemy-card hand-card static ${ec.type} f-${ec.faction}` }, ...faceKids(ec)) : null;
    const bar = h('div', { class: 'respond-bar', role: 'progressbar', 'aria-label': 'Respond time left', 'aria-valuemin': '0', 'aria-valuemax': String(CONFIG.respondWindowSeconds), 'aria-valuenow': String(CONFIG.respondWindowSeconds) }, h('div', { class: 'fill' }));
    if (!this.test) { (bar.firstChild as El).style.animationDuration = CONFIG.respondWindowSeconds + 's'; (bar.firstChild as El).style.animationDelay = -((Date.now() - this.respStart) / 1000) + 's'; }
    else (bar.firstChild as El).style.animation = 'none';
    const d = this.dialog('Respond?', [h('h2', {}, 'Respond?'), bar, cardBox, h('p', { class: 'resp-what', style: 'text-align:center;margin:0 0 6px' }, what),
      h('div', { class: 'menu-list' }, ...buttons, btn('Let it happen', 'primary', () => { finish(); this.game.act({ type: 'pass' }); }))]);
    d.el.dataset.sticky = '1';
    d.el.firstElementChild?.classList.add('respond-dlg');
    this.respDlg = d;
    clearTimeout(this.respondTimer);
    if (!this.test) {
      const t0 = this.respStart;
      const iv = setInterval(() => {
        if (this.respDlg !== d) { clearInterval(iv); return; }
        const left = Math.max(0, CONFIG.respondWindowSeconds - (Date.now() - t0) / 1000);
        bar.setAttribute('aria-valuenow', left.toFixed(1));
        if (left <= 0) { clearInterval(iv); finish(); this.game.act({ type: 'pass' }); }
      }, 100);
    }
  }

  showMatchMenuOld() {
    const d: any = this.dialog('Menu', [h('h2', {}, 'Menu'), h('div', { class: 'menu-list' },
      btn('Resume', 'primary', () => d.close()),
      btn('Surrender', 'danger', () => {
        d.close();
        const c: any = this.dialog('Surrender this match?', [h('h2', {}, 'Surrender this match?'),
          h('div', { class: 'row' }, btn('Yes, surrender', 'danger', () => { c.close(); this.game.act({ type: 'surrender' }); }), btn('Cancel', '', () => c.close()))]);
      }))]);
  }

  // ------------------------------------------------------------ animations / fx
  center(row: number, col: number) {
    const rc = this.view!.cellRect(row, col);
    return { x: rc.x + rc.w / 2, y: rc.y + rc.h / 2 };
  }
  floatText(text: string, cls: string, row: number, col: number) {
    const p = this.center(row, col);
    const f = h('div', { class: 'float ' + cls }, text);
    f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1000);
  }
  popStack = new Map<string, { n: number; t: number }>();
  uidCard = new Map<string, string>();
  /** Owner (Oct 24): a comic pop-up picture over a board square (it pops, holds, then fades). */
  pop(name: string, row: number, col: number, label = '') {
    if (!this.r.fx || !this.view) return;
    const p = this.center(row, col), key = row + ',' + col, now = performance.now();
    const st = this.popStack.get(key); const n = st && now - st.t < 700 ? st.n + 1 : 0; this.popStack.set(key, { n, t: now });
    const f = h('div', { class: 'pop-img', 'aria-hidden': 'true', 'data-pop': name }, h('img', { src: `/art/pop/${name}.webp`, alt: '', draggable: 'false' }), label ? h('span', { class: 'sr-only' }, label) : '');
    f.style.left = p.x + (n % 2 ? 8 : -5) * Math.min(n, 2) + 'px'; f.style.top = p.y - 14 - n * 14 + 'px';
    f.style.setProperty('--rot', `${(Math.random() * 14 - 7).toFixed(1)}deg`);
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1150);
  }
  speechAt = { player: 0, opponent: 0 } as Record<string, number>;
  /** Owner (Oct 24): a Commander says a line (picture) above its stronghold; one line at a time per side. */
  say(side: 'player' | 'opponent', what: string, priority = false) {
    const st = this.game?.state; if (!st || !this.r.fx || !this.view) return;
    const voice = CMD_VOICE[st.players[side]?.commanderId]; const line = voice && CMD_LINES[what]?.[voice];
    if (!line) return;
    const now = performance.now(); if (!priority && now - (this.speechAt[side] || 0) < 2600) return;
    this.speechAt[side] = now;
    this.r.fx.querySelectorAll(`.speech[data-side="${side}"]`).forEach((x: El) => x.remove());
    const p = this.center(SH[side].row, SH[side].col);
    const f = h('div', { class: 'speech cmd-speech', role: 'img', 'aria-label': 'Commander speech', 'data-side': side, 'data-line': `${voice}-${line}` }, h('img', { src: `/art/speech/${voice}-${line}.webp`, alt: '', draggable: 'false' }));
    f.style.left = p.x + 'px'; f.style.top = p.y - 70 + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 2400);
  }
  /** Test hook (R26.A4): show a commander bubble now. */
  showCommanderSpeech(side: string, _text?: string) {
    const sd = side === 'opponent' || side === 'enemy' ? 'opponent' : 'player';
    const st = this.game?.state; if (!st) return;
    const voice = CMD_VOICE[st.players[sd]?.commanderId];
    const what = Object.keys(CMD_LINES).find((k) => (CMD_LINES as any)[k]?.[voice]);
    if (what) { this.speechAt[sd] = 0; this.say(sd, what, true); }
  }
  /** Test hook (R26.A4/A8): current UI scales; unscaledWidth = size at the previous build's scale 1. */
  getUiScales() {
    const sp = document.querySelector('.cmd-speech img') as El | null;
    const rd = document.querySelector('.dialog.respond-dlg') as El | null;
    return {
      commanderSpeech: { scale: UI_SCALE.commanderSpeech, unscaledWidth: sp ? sp.getBoundingClientRect().width / UI_SCALE.commanderSpeech : 0 },
      respond: { scale: UI_SCALE.respond, unscaledWidth: rd ? rd.getBoundingClientRect().width / UI_SCALE.respond : 0, unscaledHeight: rd ? rd.getBoundingClientRect().height / UI_SCALE.respond : 0 },
    };
  }
  unitSayAt = 0;
  /** A unit says a short line (picture) above its square; rare so the board stays readable. */
  unitSay(name: string, row: number, col: number, force = false) {
    if (!this.r.fx || !this.view) return;
    const now = performance.now(); if (!force && now - this.unitSayAt < 3000) return; this.unitSayAt = now;
    const p = this.center(row, col);
    const f = h('div', { class: 'speech unit-speech', 'aria-hidden': 'true', 'data-line': name }, h('img', { src: `/art/speech/${name}.webp`, alt: '', draggable: 'false' }));
    f.style.left = p.x + 'px'; f.style.top = p.y - 52 + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1800);
  }
  fxStarted = false; lowSaid = { player: false, opponent: false } as Record<string, boolean>; siteOwner = new Map<string, string>();
  /** Red damage number over a Commander's heart, and the heart shakes. */
  heartPop(owner: string, amount: number) {
    const el = (owner === 'player' ? this.r.myHealth : this.r.enemyHealth) as El;
    if (!el) return;
    const f = h('div', { class: 'float dmg' }, '-' + amount);
    f.style.left = el.offsetLeft + el.offsetWidth / 2 + 'px'; f.style.top = el.offsetTop + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 1000);
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }
  burst(text: string, row: number, col: number) {
    if (POP_WORD[text]) { this.pop(POP_WORD[text], row, col, text); return; }
    const p = this.center(row, col);
    const f = h('div', { class: 'burst' }, text);
    f.style.left = p.x + 'px'; f.style.top = p.y - 10 + 'px';
    this.r.fx.append(f);
    setTimeout(() => f.remove(), 900);
  }
  // Commander behaviour (round 8b): faces the opponent, looks back at the player, gets impatient when the player idles
  bhv = { key: '', lastAct: Date.now(), level: 0, nextLook: new URLSearchParams(location.search).get('test') === '1' ? Infinity : Date.now() + 20000 + Math.random() * 20000, timer: 0 as any, bound: false };
  idleMs = 20000;
  cmdBehavior(st: any) {
    const b = this.bhv;
    if (!b.bound) {
      b.bound = true;
      document.addEventListener('pointerdown', () => this.playerActed(), true);
      document.addEventListener('keydown', () => this.playerActed(), true);
      b.timer = setInterval(() => this.cmdTick(), 500);
    }
    const key = `${st.turn}|${st.activePlayer}|${st.phase}`;
    if (key !== b.key) {
      b.key = key;
      this.playerActed();
      if (st.activePlayer === 'player' && st.phase === 'deploy') setTimeout(() => { if (this.bhv.key === key && this.bhv.level === 0) this.view?.lookBack('player', 1800); }, 3000);
    }
  }
  selState: () => any = () => ({ mode: 'row', commanderId: '', model: null });
  advanceIdle(seconds: number) { this.bhv.lastAct -= seconds * 1000; this.cmdTick(); this.view?.advanceFigureIdle?.(seconds); }
  playerActed() {
    const b = this.bhv;
    b.lastAct = Date.now();
    if (b.level) { b.level = 0; this.view?.impatient('player', 0); }
  }
  cmdTick() {
    const st = this.game?.state;
    const v = this.view;
    if (!st || !v || !this.root.querySelector('.match')) return;
    const b = this.bhv, now = Date.now();
    const mine = st.activePlayer === 'player' && (st.phase === 'deploy' || st.phase === 'action') && !st.pendingResponse && !document.querySelector('[role="dialog"][aria-label="Mulligan"]');
    if (!mine) { b.lastAct = now; if (b.level) { b.level = 0; v.impatient('player', 0); } return; }
    const idle = now - b.lastAct;
    const need = this.idleMs + b.level * 15000;
    if (idle >= need) { b.level++; v.impatient('player', b.level); if (b.level === 1) this.say('player', 'impatient', true); }
    else if (!b.level && now >= b.nextLook) { b.nextLook = now + 20000 + Math.random() * 20000; v.lookBack('player', 1800); }
  }
  emote(side: string, kind: any) {
    this.view && this.view.emote(side as any, kind);
    if (side === 'player' || side === 'opponent') this.say(side, kind);
  }
  animate(st: any, events: any[]) {
    if (!this.view || !this.r.fx) return;
    for (const c of st.board?.creatures || []) this.uidCard.set(c.uid, c.cardId);
    if (!this.fxStarted && st.phase !== 'mulligan') {
      this.fxStarted = true; this.lowSaid = { player: false, opponent: false };
      for (const x of st.sites || []) this.siteOwner.set(x.row + ',' + x.col, x.controller || '');
      this.say('player', 'start', true); setTimeout(() => this.say('opponent', 'start', true), 1400);
    }
    for (const e of events) {
      // owner (Oct 24): comic pop-ups and speech bubbles
      if (e.type === 'attack' && e.target) {
        const cid = this.uidCard.get(e.uid) || '', ab: string[] = CARDS[cid]?.abilities || [];
        const tgt = e.target.commander ? SH[e.target.commander as 'player' | 'opponent'] : e.target;
        const def = e.target.commander ? null : st.board.creatures.find((c: any) => c.row === e.target.row && c.col === e.target.col);
        const dab: string[] = def ? CARDS[def.cardId]?.abilities || [] : [];
        const word = ab.includes('sneaky') && !e.ranged ? 'backstabbed' : def && (dab.includes('armored') || dab.includes('unbreakable') || dab.includes('riotShield') || def.shield > 0) ? 'clang' : HIT_POP[cid] || (e.ranged ? 'thwack' : 'whack');
        if (tgt) this.pop(word, tgt.row, tgt.col);
      } else if (e.type === 'move' && e.knock && e.to && !events.some((x: any, j: number) => j > events.indexOf(e) && x.type === 'move' && x.knock && x.uid === e.uid)) this.pop('knockback', e.to.row, e.to.col);
      else if (e.type === 'steal') { const c = st.board.creatures.find((x: any) => x.uid === e.uid); if (c) { this.pop('stolen', c.row, c.col); this.unitSay('unit-mine-now', c.row, c.col, true); } }
      else if (e.type === 'poisoned') this.pop('poisoned', e.row, e.col);
      else if (e.type === 'drunk') { this.pop('hic', e.row, e.col); this.unitSay('unit-hic', e.row, e.col); }
      else if (e.type === 'brewSave') this.pop('saved', e.row, e.col);
      else if (e.type === 'ward') this.pop('ward', e.row, e.col);
      else if (e.type === 'heal' && e.amount > 0 && e.row) this.pop('heal', e.row, e.col);
      else if (e.type === 'mine' && e.uid) { const c = st.board.creatures.find((x: any) => x.uid === e.uid); if (c) { this.pop('clink', c.row, c.col); if (c.owner === 'player' && Math.random() < 0.3) this.unitSay('unit-shiny', c.row, c.col); } }
      else if (e.type === 'minerUpgrade' && e.row) { this.pop('upgrade', e.row, e.col); this.unitSay('unit-good-as-new', e.row, e.col, true); }
      else if (e.type === 'summon' && e.owner === 'player' && !e.illusion && e.row) this.unitSay(Math.random() < 0.5 ? 'unit-reporting' : 'unit-ready', e.row, e.col);
      else if (e.type === 'abilityUsed' && e.ability === 'brew') this.unitSay('unit-bottoms-up', e.row, e.col, true);
      else if (e.type === 'abilityUsed' && e.ability === 'slide') this.unitSay('unit-uh-oh', e.row, e.col, true);
      else if (e.type === 'fizzle') { const sd = st.activePlayer === 'player' ? 'player' : 'opponent'; this.pop('fizzle', SH[sd].row, SH[sd].col); }
      else if (e.type === 'turnStart' && e.player === 'player' && e.turn > 1) this.say('player', 'turn');
      else if (e.type === 'bonusDraw') {
        const why = [e.fromMining ? `${e.mined} crystals mined` : '', e.allMines ? 'all 3 mines' : ''].filter(Boolean).join(' + ');
        const who = e.player === 'player' ? 'You draw' : 'Opponent draws';
        setTimeout(() => this.flash(`${who} +${e.cards} card${e.cards > 1 ? 's' : ''} (${why})`), 900);
      }
      else if (e.type === 'siteControl') {
        const k = e.row + ',' + e.col, was = this.siteOwner.get(k) || '', now = e.controller || '';
        this.siteOwner.set(k, now);
        if (now && now !== was) { this.say(now, 'mine', true); if (was) setTimeout(() => this.say(was as any, 'lostMine', true), 900); }
      } else if (e.type === 'damage' && e.commander) {
        const side = e.commander as 'player' | 'opponent';
        if (!this.lowSaid[side] && st.players[side].health > 0 && st.players[side].health <= 5) { this.lowSaid[side] = true; setTimeout(() => this.say(side, 'low', true), 1200); }
      }
      if (e.type === 'damage') {
        const owner = e.commander;
        if (owner) {
          const row = SH[owner as 'player' | 'opponent'].row, col = SH[owner as 'player' | 'opponent'].col;
          this.heartPop(owner, e.amount);
          if (e.amount >= 3) this.burst(e.amount >= 5 ? 'KA-BOOM!' : 'CRUNCH!', row, col);
          this.emote(owner, 'flinch');
          this.emote(owner === 'player' ? 'opponent' : 'player', 'cheer');
        } else if (e.amount > 0) {
          this.floatText('-' + e.amount, 'dmg', e.row, e.col);
          if (e.amount >= 3) this.burst('CRUNCH!', e.row, e.col);
        }
      } else if (e.type === 'abilityUsed' && ABILITY_UI[e.ability]) {
        this.burst(ABILITY_UI[e.ability].burst, e.row, e.col);
      } else if (e.type === 'draw' && (e.player === 'player' || e.owner === 'player')) {
        audio.play('draw');
      } else if (e.type === 'shieldBlock') {
        audio.play('bubble');
        this.burst('BLOCK!', e.row, e.col);
      } else if (e.type === 'poison') {
        this.floatText('☠ 1', 'dmg', e.row, e.col);
      } else if (e.type === 'heal' && e.amount > 0) {
        if (e.row) this.floatText('+' + e.amount, 'heal', e.row, e.col);
        else this.floatText('+' + e.amount, 'heal', SH[e.commander as 'player' | 'opponent'].row, SH[e.commander as 'player' | 'opponent'].col);
      } else if (e.type === 'defeat') {
        this.burst('POOF!', e.row, e.col);
        this.emote(e.owner, 'groan');
        this.emote(e.owner === 'player' ? 'opponent' : 'player', 'cheer');
      } else if (e.type === 'cast') {
        this.callout(e.player, e.cardId);
      } else if (e.type === 'respond') {
        this.callout(e.player, e.cardId);
      } else if (e.type === 'counter') { this.shatter(e.player); audio.play('shatter'); if (e.cardId) this.spellFx({ cardId: e.cardId, player: e.player, target: null }); }
      else if (e.type === 'spell') {
        this.emote(e.player, 'cast'); this.spellFx(e);
        const id = String(e.cardId);
        audio.play(id === 'fireball' ? 'fireball' : id === 'meteor-strike' ? 'meteor' : id === 'healing-light' || id === 'second-wind' ? 'heal' : id === 'shield-bubble' ? 'bubble' : 'spell');
      }
      else if (e.type === 'summon') {
        audio.play('cardPlay');
      } else if (e.type === 'playCrystal') audio.play('cardPlay');
      else if (e.type === 'minerUpgrade') {
        this.floatText(`+${e.attack ? '1 ATK ' : ''}+1 HP ✨`, 'heal', e.row, e.col);
      }
      else if (e.type === 'savings' && e.player === 'player') this.bankFly(e.amount);
      else if (e.type === 'income' && e.player === 'player' && e.amount > 0) this.flash(`+${e.amount} crystals`);
      else if (e.type === 'siteControl' && e.controller) this.flash('THE CRYSTAL. HAS. FALLEN.');
    }
    if (st.phase === 'over' && !this.endShown) {
      this.endShown = true;
      const loser = st.winner === 'player' ? 'opponent' : 'player';
      const esc = FACTIONS[st.players[loser].faction].symbol === 'skull' ? '🚀' : FACTIONS[st.players[loser].faction].symbol === 'gear' ? '💨' : '🕳️';
      const t = this.test ? (this.game.mode === 'compvscomp' ? 4000 : 120) : 1600; // a test-mode Card Comp match ends in an instant: keep its watch bar usable for a few seconds
      this.view?.retreat(loser);
      audio.play(st.winner === 'player' ? 'win' : 'lose');
      this.say(st.winner, 'win', true); this.say(loser as any, 'lose', true);
      const ov = h('div', { class: 'retreat', 'aria-hidden': 'true' }, h('img', { class: 'retreat-result', src: `/art/ui/banner-${endBanner(st.winner === 'player', st)}.webp`, alt: '', draggable: 'false' }), h('div', { class: 'esc' }, st.players[loser].commanderId === 'grubnak' ? '' : esc));
      this.root.querySelector('.match')?.append(ov);
      const winner = st.winner;
      setTimeout(() => this.showEnd(winner), t);
    }
  }
  /** "+N banked" text that flies into the Bank counter and stays at least 1.5 s (R9.2). */
  bankFly(n: number) {
    const bank = this.r.crBank as El;
    if (!bank) return;
    const rr = this.root.getBoundingClientRect(), br = bank.getBoundingClientRect();
    const f = h('div', { class: 'banked', role: 'status' }, `+${n} banked`);
    f.style.setProperty('--dx', `${br.left - rr.left + br.width / 2 - rr.width / 2}px`);
    f.style.setProperty('--dy', `${br.top - rr.top + br.height / 2 - rr.height / 2}px`);
    (this.root.querySelector('.match') || this.root).append(f);
    bank.classList.remove('bump'); void bank.offsetWidth; bank.classList.add('bump');
    setTimeout(() => f.remove(), 2600);
  }
  flash(text: string) {
    const r = this.r;
    if (!r.board) return;
    r.board.querySelectorAll('.hint').forEach((x: El) => x.remove());
    const pic = MSG_PIC[text];
    const hint = pic ? h('div', { class: 'hint hint-pic', role: 'status' }, h('img', { src: `/art/speech/${pic}.webp`, alt: '', draggable: 'false' }), h('span', { class: 'sr-only' }, text)) : h('div', { class: 'hint', role: 'status' }, text);
    r.board.append(hint);
    setTimeout(() => hint.remove(), 1600);
  }

  showEnd(winner: string) {
    if (!this.game.state || this.game.state.phase !== 'over' || !this.root.querySelector('.match')) return; // left for the menu meanwhile
    const st = this.game.state;
    this.clear();
    const win = winner === 'player';
    const sx = st.stats || { mined: { player: 0, opponent: 0 }, summoned: { player: 0, opponent: 0 }, lost: { player: 0, opponent: 0 }, damage: {} };
    let mvp = 'None';
    const best = Object.entries(sx.damage as Record<string, number>).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) {
      const uid = best[0];
      const id = (sx.cards || {})[uid];
      if (id) mvp = `${CARDS[id].name} — ${best[1]} damage`;
    }
    const rowOf = (label: string, you: string, foe?: string) => h('tr', {}, h('th', { scope: 'row' }, label), h('td', {}, foe == null ? you : `You ${you} · Enemy ${foe}`));
    const table = h('table', { class: 'summary', 'aria-label': 'Match summary' },
      rowOf('Crystals mined', String(sx.mined.player), String(sx.mined.opponent)),
      rowOf('Creatures summoned', String(sx.summoned.player), String(sx.summoned.opponent)),
      rowOf('Creatures lost', String(sx.lost.player), String(sx.lost.opponent)),
      rowOf('Turns', String(st.turn)),
      rowOf('MVP', mvp));
    this.root.append(h('main', { class: 'screen center end' },
      h('h1', { class: 'end-title' }, h('img', { class: 'end-pic', src: `/art/ui/banner-${endBanner(win, st)}.webp`, alt: '', draggable: 'false', 'data-end-level': endBanner(win, st) }), h('span', { class: 'sr-only' }, win ? 'Victory!' : 'Defeat')),
      h('p', {}, win ? 'The enemy Commander fled screaming that this was all part of the plan.' : 'Your Commander escaped at the last second, shouting that this was all part of the plan.'),
      table,
      h('div', { class: 'row' },
        btn(this.game.mode === 'compvscomp' ? 'Rematch' : 'Play again', 'primary', () => { if (this.lastTutorial) this.beginTutorial(); else { const o = { ...this.lastOptions }; this.beginMatch(o); } }),
        btn('Menu', '', () => this.showMenu(), this.game.mode === 'compvscomp' ? { 'aria-label': 'Exit to menu' } : {}))));
  }

  // ------------------------------------------------------------ board geometry / hit testing
  cellAt(x: number, y: number): { row: number; col: number } | null {
    const bb = (this.r.board as El).getBoundingClientRect();
    const px = x - bb.left, py = y - bb.top;
    let best: any = null, bd = 1e9;
    for (let row = 1; row <= BH; row++) for (let col = 1; col <= BW; col++) {
      const rc = this.view!.cellRect(row, col);
      if (px < rc.x || px > rc.x + rc.w || py < rc.y || py > rc.y + rc.h) continue;
      const d = Math.hypot(px - rc.x - rc.w / 2, py - rc.y - rc.h / 2);
      if (d < bd) { bd = d; best = { row, col }; }
    }
    return best;
  }
  setGlow(cells: { row: number; col: number }[], cls: string) {
    for (const c of cells) {
      const row = c.row;
      const col = c.col;
      const el = this.r.cells.get(row + ',' + col) as El | undefined;
      if (el) { el.classList.add(cls); el.style.setProperty('--pfc', FACTION_GLOW[(this.game.state.players.player.faction as string)] || '#3ee06a'); this.place(el, row, col); }
    }
  }
  clearGlow() {
    this.dragKind = '';
    for (const el of this.r.cells.values() as Iterable<El>) { if (el.style.clipPath) el.style.clipPath = ''; el.classList.remove('glow', 'glow-attack', 'glow-swap', 'glow-mine', 'hover'); }
    this.r.board.classList.remove('drop-any');
  }
  cellOfTarget(t: any) { return t.commander ? SH[t.commander as 'player' | 'opponent'] : { row: t.row, col: t.col }; }

  // ------------------------------------------------------------ pointer interactions
  drag(e: PointerEvent, opts: { ghost: El; onStart: () => boolean | void; onDrop: (cell: { row: number; col: number } | null, x: number, y: number) => void; onTap: () => void; touchSwipe?: (dx: number) => void; onHover?: (cell: { row: number; col: number } | null, x: number, y: number) => void; onEnd?: () => void; manualHand?: boolean; onMove?: (dx: number, x: number, y: number) => void }) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false, swiping = false, lastX = x0;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!dragging && !swiping && Math.hypot(dx, dy) > 8) {
        if (ev.pointerType !== 'mouse' && opts.touchSwipe && Math.abs(dx) > Math.abs(dy)) swiping = true;
        else if (opts.onStart() !== false) { dragging = true; if (!opts.manualHand) this.r.hand?.classList.add('away'); opts.ghost.style.left = ev.clientX + 'px'; opts.ghost.style.top = ev.clientY + 'px'; document.body.append(opts.ghost); lastX = ev.clientX; }
        else cleanup();
      }
      if (swiping) { opts.touchSwipe!(ev.clientX - lastX); lastX = ev.clientX; }
      if (dragging) {
        opts.ghost.style.left = ev.clientX + 'px'; opts.ghost.style.top = ev.clientY + 'px';
        opts.onMove && opts.onMove(ev.clientX - lastX, ev.clientX, ev.clientY); lastX = ev.clientX;
        const c = this.cellAt(ev.clientX, ev.clientY);
        for (const el of this.r.cells.values() as Iterable<El>) el.classList.remove('hover');
        if (c) this.r.cells.get(c.row + ',' + c.col)?.classList.add('hover');
        opts.onHover && opts.onHover(c, ev.clientX, ev.clientY);
      }
    };
    const up = (ev: PointerEvent) => {
      const was = dragging;
      cleanup();
      if (was) {
        const bb = (this.r.board as El).getBoundingClientRect();
        const inBoard = ev.clientX >= bb.left && ev.clientX <= bb.right && ev.clientY >= bb.top && ev.clientY <= bb.bottom;
        opts.onDrop(inBoard ? this.cellAt(ev.clientX, ev.clientY) || { row: 0, col: 0 } : null, ev.clientX, ev.clientY);
      } else if (!swiping) opts.onTap();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up2);
      opts.ghost.remove();
      opts.onEnd && opts.onEnd();
      this.r.hand?.classList.remove('away');
      this.clearGlow();
      this.r.hand?.querySelectorAll('.dragging').forEach((x: El) => x.classList.remove('dragging'));
    };
    const up2 = () => { dragging = false; swiping = true; cleanup(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up2);
  }

  dragFx: any = null;
  /** Test hook (Round 26): the dragged hand card (centre, corners, width, legal) or null. */
  getDragCard() {
    const f = this.dragFx;
    if (!f || !f.corners.length) return null;
    const xs = f.corners.map((p: any) => p.x), ys = f.corners.map((p: any) => p.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const g = document.querySelector('.dragged-card') as El | null;
    return { cardId: g?.dataset.cardId, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, pointer: { x: f.px, y: f.py }, width: x1 - x0, height: y1 - y0, startWidth: f.startW, corners: f.corners.map((p: any) => ({ ...p })), opacity: g ? parseFloat(g.style.opacity || '1') : 1, legal: f.legal, highlight: f.cell ? { row: f.cell.row, col: f.cell.col, legal: f.legal } : null, shrink: f.s };
  }
  /** Corners of a board square ordered TL, TR, BR, BL. */
  sortedQuad(row: number, col: number) {
    const q = this.squareQuad(row, col);
    if (!q || q.length < 4) return null;
    const byY = [...q].sort((a: any, b: any) => a.y - b.y);
    const top = byY.slice(0, 2).sort((a: any, b: any) => a.x - b.x), bot = byY.slice(2, 4).sort((a: any, b: any) => a.x - b.x);
    return [top[0], top[1], bot[1], bot[0]];
  }
  /** Square nearest to the pointer while it is over the board (gaps keep the nearest square). */
  nearestCell(x: number, y: number): { row: number; col: number } | null {
    const bb = (this.r.board as El).getBoundingClientRect();
    if (x < bb.left || x > bb.right || y < bb.top || y > bb.bottom) return null;
    const c = this.cellAt(x, y); if (c) return c;
    let best: any = null, bd = 1e9;
    for (let row = 1; row <= BH; row++) for (let col = 1; col <= BW; col++) {
      const p = this.squareToScreen(row, col); if (!p) continue;
      const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = { row, col }; }
    }
    return best;
  }

  cardPointerDown(e: PointerEvent, hc: any, el: El) {
    if (e.pointerType !== 'mouse') {
      const t = setTimeout(() => this.popCard(el, true), 180);
      const off = () => { clearTimeout(t); this.popCard(el, false); window.removeEventListener('pointerup', off); window.removeEventListener('pointercancel', off); };
      window.addEventListener('pointerup', off); window.addEventListener('pointercancel', off);
    }
    const st = this.game.state;
    const card = CARDS[hc.cardId];
    // round 11: the drag shows the real card face, floating and tilting with the movement
    const ghost = h('div', { class: `hand-card static dragged-card ${card.type} f-${card.faction}`, role: 'group', 'aria-label': 'Dragged card', 'data-tilt': '0', 'data-card-id': card.id, 'data-frame': frameKey(card), 'data-rarity': rarityKey(card) }, h('span', { class: 'drag-id', 'aria-hidden': 'true', 'data-card-id': card.id, style: 'position:absolute;width:0;height:0;overflow:hidden' }), ...faceKids(card, card.type === 'crystal' ? 0 : card.cost));
    let tilt = 0, mode: 'reorder' | 'play' | '' = '';
    // reordering while the pointer stays near its grab height / inside the raised hand; moving clearly above both = playing the card
    let homeBottom = -Infinity;
    try { for (let c = 1; c <= 13; c++) for (const q of this.squareQuad(7, c) as any[]) homeBottom = Math.max(homeBottom, q.y); } catch { /* no board yet */ }
    const handTop = (this.r.hand as El).getBoundingClientRect().top - 12, startY = e.clientY, startX = e.clientX;
    // the hand may overlap the home row: only the horizontal span of the fan counts as "in the hand"
    const fan = ([...(this.r.hand as El).querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[]).map((c) => c.getBoundingClientRect());
    const fanL = Math.min(...fan.map((b) => b.left)) - 24, fanR = Math.max(...fan.map((b) => b.right)) + 24;
    const inFan = (x: number) => x >= fanL && x <= fanR;
    // round 12a: a pointer over the board that is not inside the hand band is always a play drag (grab height no longer decides)
    const overBoard = (x: number, y: number) => { const bb = (this.r.board as El).getBoundingClientRect(); return (y < handTop || !inFan(x)) && x >= bb.left && x <= bb.right && y >= bb.top && y <= bb.bottom; };
    // a legal target square under the pointer always means "play", even where the hand overlaps the home row
    const overLegal = (x: number, y: number) => { const c = this.cellAt(x, y); return !!c && [...plan.cells, ...plan.smith].some((q: any) => q && q.row === c.row && q.col === c.col); };
    const inReorder = (y: number, x = 0) => Math.hypot(x - startX, y - startY) < 25 || !overLegal(x, y) && ((y >= handTop && inFan(x)) || (Math.abs(y - startY) < 45 && !overBoard(x, y)));
    let plan: { cells: any[]; smith: any[]; any: boolean } = { cells: [], smith: [], any: false };
    const setMode = (m: 'reorder' | 'play') => {
      if (m === mode) return;
      mode = m;
      const hd = this.r.hand as El;
      this.clearGlow();
      if (m === 'reorder') { hd.classList.remove('away'); return; }
      hd.classList.add('away'); // tuck the hand away over the board
      this.dragKind = card.type;
      this.setGlow(plan.cells, 'glow');
      this.setGlow(plan.smith, 'glow-swap');
      if (plan.any) this.r.board.classList.add('drop-any');
    };
    // A1 (Round 26): the pointer stays at the card centre; over a square the card shrinks (matrix3d) onto that square's quad
    const fx: any = { px: e.clientX, py: e.clientY, tilt: 0, s: 0, tgt: 0, q: null, qt: null, cell: null, legal: false, t: performance.now(), done: false, raf: 0, hl: null, corners: [] as any[], W: 0, H: 0, startW: 0 };
    const fxRender = () => {
      if (fx.done || !ghost.isConnected) return;
      const now = performance.now(), dt = Math.min(100, now - fx.t); fx.t = now;
      const W = ghost.offsetWidth, H = ghost.offsetHeight;
      if (!W || !H) return;
      if (!fx.startW) fx.startW = W;
      fx.W = W; fx.H = H;
      const step = dt / DRAG_FX.shrinkMs;
      fx.s = fx.tgt > fx.s ? Math.min(fx.tgt, fx.s + step) : Math.max(fx.tgt, fx.s - step);
      if (fx.qt) { if (!fx.q) fx.q = fx.qt.map((p: any) => ({ ...p })); else { const k = 1 - Math.exp(-dt / 35); fx.q = fx.q.map((p: any, i: number) => ({ x: p.x + (fx.qt[i].x - p.x) * k, y: p.y + (fx.qt[i].y - p.y) * k })); } }
      if (!fx.qt && fx.s === 0) fx.q = null;
      const a = fx.tilt * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      const free = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]].map(([x, y]) => ({ x: fx.px + x * ca - y * sa, y: fx.py + x * sa + y * ca }));
      const e = fx.s * fx.s * (3 - 2 * fx.s);
      const cs = fx.q ? free.map((p, i) => ({ x: p.x + (fx.q[i].x - p.x) * e, y: p.y + (fx.q[i].y - p.y) * e })) : free;
      fx.corners = cs;
      ghost.style.transform = homography(cs, W, H);
      ghost.style.opacity = String(1 - (1 - DRAG_FX.shrinkOpacity) * e);
      ghost.dataset.shrink = e.toFixed(2);
      // outline of the square under the card
      if (fx.qt) {
        if (!fx.hl) { fx.hl = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); fx.hl.setAttribute('class', 'drag-square-hl'); fx.hl.setAttribute('aria-hidden', 'true'); fx.hl.append(document.createElementNS('http://www.w3.org/2000/svg', 'polygon')); document.body.append(fx.hl); }
        fx.hl.dataset.legal = fx.legal ? '1' : '0';
        fx.hl.dataset.cell = fx.cell ? fx.cell.row + ',' + fx.cell.col : '';
        const poly = fx.hl.firstChild as SVGElement;
        poly.setAttribute('points', fx.qt.map((p: any) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' '));
        poly.setAttribute('stroke', fx.legal ? (FACTION_GLOW[this.game.state.players.player.faction as string] || DRAG_FX.legal) : DRAG_FX.illegal);
        poly.setAttribute('fill', fx.legal ? 'rgba(62,224,106,.12)' : 'rgba(176,64,64,.14)');
      } else if (fx.hl) { fx.hl.remove(); fx.hl = null; }
    };
    this.drag(e, {
      ghost,
      manualHand: true,
      touchSwipe: (dx) => { this.handScroll -= dx / 40; this.layoutHand(); },
      onMove: (dx, px, y) => {
        tilt = Math.max(-DRAG_FX.tiltMax, Math.min(DRAG_FX.tiltMax, tilt * 0.8 + dx * 0.3));
        ghost.dataset.tilt = tilt.toFixed(2);
        setMode(inReorder(y, px) || !(plan.cells.length || plan.smith.length || plan.any) ? 'reorder' : 'play'); // an unplayable card can only be reordered
        fx.px = px; fx.py = y; fx.tilt = tilt;
        if (mode === 'play') {
          const n = this.nearestCell(px, y);
          fx.cell = n;
          fx.legal = !!n && (plan.any || [...plan.cells, ...plan.smith].some((q: any) => q && q.row === n.row && q.col === n.col));
          const q = n && this.sortedQuad(n.row, n.col);
          fx.qt = q || null; fx.tgt = q ? 1 : 0;
        } else { fx.cell = null; fx.legal = false; fx.qt = null; fx.tgt = 0; }
        fxRender();
      },
      onEnd: () => { fx.done = true; cancelAnimationFrame(fx.raf); fx.hl?.remove(); if (this.dragFx === fx) this.dragFx = null; },
      onStart: () => {
        if (this.pick || this.respDlg) return false;
        fx.px = e.clientX; fx.py = e.clientY; this.dragFx = fx;
        const loop = () => { if (fx.done) return; fxRender(); fx.raf = requestAnimationFrame(loop); };
        fx.raf = requestAnimationFrame(loop);
        this.popCard(el, false);
        this.clearPops(); this.openHand(false, true); (this.r.hand as El).classList.add('tuck'); // R23.2: the rest of the hand tucks the moment a card is grabbed, until the pointer hovers it again
        el.classList.add('dragging');
        const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
        if (!legal.length) { this.flash(this.explain(card)); }
        const cells: any[] = [];
        const smithCells: any[] = [];
        let any = false;
        for (const a of legal) {
          if (a.type === 'summon') cells.push({ row: a.row, col: a.col });
          else if (a.type === 'minerUpgrade') { const o = st.board.creatures.find((x: any) => x.uid === a.creatureUid); if (o) smithCells.push({ row: o.row, col: o.col }); }
          else if (a.type === 'cast') { if (!a.target) any = true; else if (!a.to || true) cells.push(this.cellOfTarget(a.target)); }
          else if (a.type === 'playCrystal') any = true;
        }
        plan = { cells, smith: smithCells, any };
        setMode('reorder');
        return true;
      },
      onDrop: (cell, x, y) => {
        if (mode === 'reorder') { this.reorderHand(hc.uid, x); return; }
        if (cell && (cell.row || plan.smith.length)) this.dropCard(hc, card, cell, x, y);
      },
      onTap: () => {
        if (this.swapping) {
          this.swapping = false;
          const a = this.game.legalActions().find((x: any) => x.type === 'gathererSwap' && x.discardUid === hc.uid);
          if (a) this.game.act(a);
          return;
        }
        this.showCard(card.id, undefined, hc);
      },
    });
    void st;
  }

  /** Round 11: drop a dragged hand card at pointer x: it takes the place among the other cards (order kept for the match). */
  reorderHand(uid: string, x: number) {
    const hand = this.game.state?.players?.player?.hand as any[] | undefined;
    if (!hand) return;
    const others = ([...(this.r.hand as El).querySelectorAll('.hand-card:not(.popclone):not(.offhand)')] as El[]).filter((c) => c.dataset.uid !== uid);
    let idx = 0;
    for (const c of others) { const b = c.getBoundingClientRect(); if (x > b.left + b.width / 2) idx++; }
    const from = hand.findIndex((k) => k.uid === uid);
    if (from < 0) return;
    const rest = hand.filter((k) => k.uid !== uid);
    const ordered = others.map((c) => rest.find((k) => k.uid === c.dataset.uid)).filter(Boolean) as any[];
    const tail = rest.filter((k) => !ordered.includes(k));
    ordered.splice(Math.min(idx, ordered.length), 0, hand[from]);
    const next = [...ordered, ...tail];
    if (next.every((k, i) => k === hand[i])) return;
    hand.splice(0, hand.length, ...next);
    this.handKey = '';
    this.update(this.game.state, []);
  }

  explain(card: any) {
    const st = this.game.state;
    if (st.activePlayer !== 'player') return "It's not your turn";
    if (card.type === 'creature' && st.phase !== 'deploy') return 'Creatures are summoned in the Deploy phase';
    if (card.type === 'crystal') return st.phase !== 'deploy' ? 'Crystal cards are played in the Deploy phase or when you respond' : 'Only one Crystal card per round';
    return "You can't play that right now";
  }

  dropCard(hc: any, card: any, cell: { row: number; col: number }, x?: number, y?: number, asked = false) {
    if (!asked && (card.type === 'creature' || card.type === 'spell')) {
      const st0 = this.game.state;
      const cost = card.type === 'creature' ? creatureCost(st0, 'player', card) : spellCost(st0, 'player', card);
      if (this.game.legalActions().some((a: any) => a.uid === hc.uid && a.type !== 'minerUpgrade')) { this.payGate(cost, () => this.dropCard(hc, card, cell, x, y, true)); return; }
    }
    const legal = this.game.legalActions().filter((a: any) => a.uid === hc.uid);
    if (!legal.length) { this.flash(this.explain(card)); return; }
    const ups = legal.filter((a: any) => a.type === 'minerUpgrade');
    if (ups.length) {
      let own = this.game.state.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col && c.owner === 'player');
      if (!own && x != null && y != null) {
        // the stat badge hangs below a token: a drop on the figure or its badge counts as a drop on that creature
        let bestD = 1e9;
        for (const [uid, el] of this.tokens) {
          const c = this.game.state.board.creatures.find((k: any) => k.uid === uid);
          if (!c || c.owner !== 'player' || !ups.some((a: any) => a.creatureUid === c.uid)) continue;
          const r = el.getBoundingClientRect();
          const d = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
          if (d < bestD && d <= 48) { bestD = d; own = c; }
        }
      }
      const up = own && ups.find((a: any) => a.creatureUid === own.uid);
      if (up) { const r = this.game.act(up); if (r && !r.ok) this.flash(r.error); return; }
    }
    const t = legal.find((a: any) => a.type !== 'minerUpgrade')?.type || legal[0].type;
    const res = (r: any) => { if (r && !r.ok) this.flash(r.error); };
    if (t === 'summon') {
      const a = legal.find((x: any) => x.row === cell.row && x.col === cell.col);
      if (a) res(this.game.act(a)); else this.flash("Can't summon there");
    } else if (t === 'playCrystal') {
      res(this.game.act(legal[0]));
    } else if (t === 'cast') {
      if (!legal[0].target) { res(this.game.act(legal[0])); return; }
      const cands = legal.filter((o: any) => { const c = this.cellOfTarget(o.target); return c.row === cell.row && c.col === cell.col; });
      if (!cands.length) { this.flash('Invalid target'); return; }
      if (cands.length === 1) { res(this.game.act(cands[0])); return; }
      this.pick = { cells: cands.map((o: any) => o.to), done: (c) => { this.pick = null; this.clearGlow(); res(this.game.act(cands.find((o: any) => o.to.row === c.row && o.to.col === c.col))); } };
      this.setGlow(this.pick.cells, 'glow');
      this.flash('Tap where to move it');
    }
  }

  /** The creature under a pointer event (its square or its stat badge), if any. */
  unitAtEvent(e: PointerEvent | MouseEvent): any {
    const st = this.game.state;
    if (!st || !this.r.board) return null;
    const lab = (e.target as El)?.closest?.('.tk-stats');
    const labUid = lab ? (lab.closest('.token') as El | null)?.dataset.uid : null;
    if (labUid) return st.board.creatures.find((c: any) => c.uid === labUid) || null;
    const c = this.cellAt(e.clientX, e.clientY);
    return c ? st.board.creatures.find((x: any) => x.row === c.row && x.col === c.col) || null : null;
  }
  /** Owner (Oct 25): left-click a unit to use it: its moves, attacks, mining and aimed abilities light up; click one to do it. */
  selectUnit(cr: any) {
    const st = this.game.state;
    this.pick = null; this.clearGlow();
    if (this.respDlg) return;
    const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
    const isMove = (a: any) => a.type === 'move';
    const swapAt = (a: any) => st.board.creatures.some((o: any) => o.row === a.row && o.col === a.col);
    const groups: [any[], string][] = [
      [legal.filter((a: any) => isMove(a) && !swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow'],
      [legal.filter((a: any) => isMove(a) && swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow-swap'],
      [legal.filter((a: any) => a.type === 'attack').map((a: any) => this.cellOfTarget(a.target)), 'glow-attack'],
      [legal.filter((a: any) => a.type === 'mine').map((a: any) => ({ row: a.row, col: a.col })), 'glow-mine'],
      [legal.filter((a: any) => a.type === 'ability' && this.abilityCell(a, cr)).map((a: any) => this.abilityCell(a, cr)!), 'glow-swap'],
    ];
    const cells = groups.flatMap((g) => g[0]);
    if (!cells.length) return;
    for (const [c, cls] of groups) this.setGlow(c, cls);
    const uid = cr.uid;
    this.pick = { cells, unit: uid, done: (c: any) => {
      this.pick = null; this.clearGlow();
      const cur = this.game.state.board.creatures.find((x: any) => x.uid === uid);
      if (cur) this.unitActAt(cur, c);
    } } as any;
  }
  /** Do what a unit dropped (or clicked) onto square c means: attack, mine, move or an aimed ability. */
  unitActAt(cr: any, c: { row: number; col: number }) {
    if (!c || !c.row) return;
    const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
    const atk = legal.find((a: any) => a.type === 'attack' && ((a.target.commander && c.row === SH[a.target.commander as 'player' | 'opponent'].row && c.col === SH[a.target.commander as 'player' | 'opponent'].col) || (a.target.row === c.row && a.target.col === c.col)));
    const mv = legal.find((a: any) => a.type === 'move' && a.row === c.row && a.col === c.col);
    const mn = legal.find((a: any) => a.type === 'mine' && a.row === c.row && a.col === c.col);
    const ab = legal.filter((a: any) => a.type === 'ability' && this.abilityCell(a, cr));
    const abHere = ab.filter((a: any) => { const q = this.abilityCell(a, cr)!; return q.row === c.row && q.col === c.col; });
    const abPick = (a0: any) => (a0.ability === 'shaman' ? this.bestShaman(abHere.filter((x: any) => x.ability === 'shaman'), cr) : a0);
    const a = atk || mn || mv || (abHere[0] ? abPick(abHere[0]) : null);
    if (a) { const r = this.game.act(a); if (!r.ok) this.flash(r.error!); } else this.flash("Can't go there");
  }

  boardPointerDown(e: PointerEvent) {
    const st = this.game.state;
    if (!st) return;
    // Owner (Oct 25): the right mouse button opens a unit's card (and its ability menu); the left button uses units
    if (e.pointerType === 'mouse' && e.button === 2) {
      const u = this.unitAtEvent(e);
      if (u) {
        e.preventDefault();
        this.view?.poke(u.uid);
        if (u.owner === 'player') this.abilityMenu(u);
        if (!this.dialogs.length) this.showCard(u.cardId, u);
      }
      return;
    }
    const lab = (e.target as El).closest?.('.tk-stats');
    const labUid = lab ? (lab.closest('.token') as El | null)?.dataset.uid : null;
    const cell = labUid ? (() => { const c0 = st.board.creatures.find((c: any) => c.uid === labUid); return c0 ? { row: c0.row, col: c0.col } : null; })() : this.cellAt(e.clientX, e.clientY);
    if (!cell) { if (!this.pick && (e.pointerType !== 'mouse' || e.button === 0)) this.startPan(e); return; }
    if (this.pick) {
      const p = this.pick.cells.find((c) => c.row === cell.row && c.col === cell.col);
      if (p) { this.pick.done(p); return; }
      const unitPick = !!(this.pick as any).unit;
      this.pick = null; this.clearGlow();
      // a unit was selected: clicking another of your units selects that one instead; clicking elsewhere just deselects
      const other = st.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col);
      if (!(unitPick && other && other.owner === 'player')) { if (!unitPick) this.flash('Cancelled'); return; }
    }
    const cr = st.board.creatures.find((c: any) => c.row === cell.row && c.col === cell.col);
    if (!cr) { if (e.pointerType !== 'mouse' || e.button === 0) this.startPan(e); return; }
    this.selectedUid = cr.uid; // round 11: the tapped creature counts as selected (Esc clears it)
    const card = CARDS[cr.cardId];
    const ghost = h('div', { class: 'ghost tk' }, FSYM(card.faction));
    const mine = cr.owner === 'player';
    let box: El | null = null;
    const atkAt = (c: { row: number; col: number }) => this.game.legalActions().find((a: any) => a.creatureUid === cr.uid && a.type === 'attack' && ((a.target.commander && c.row === SH[a.target.commander as 'player' | 'opponent'].row && c.col === SH[a.target.commander as 'player' | 'opponent'].col) || (a.target.row === c.row && a.target.col === c.col)));
    this.drag(e, {
      ghost,
      onHover: (c, x, y) => {
        const a = mine && c ? atkAt(c) : null;
        const pv: any = a ? previewAttack(this.game.state, cr.uid, a.target) : null;
        if (!pv) { box?.remove(); box = null; return; }
        if (!box) { box = h('div', { class: 'atk-preview', 'aria-label': 'Attack preview', role: 'status' }); document.body.append(box); }
        const dead = pv.targetDefeated || pv.attackerDefeated;
        box.replaceChildren(`You deal ${pv.youDeal} / You take ${pv.youTake}`, ...(dead ? [h('span', { class: 'skull' }, ` ${pv.targetDefeated ? '💀' : ''}${pv.attackerDefeated ? '💀' : ''}`)] : []));
        box.style.left = x + 'px'; box.style.top = y + 'px';
      },
      onEnd: () => { box?.remove(); box = null; },
      onStart: () => {
        if (!mine || this.respDlg) return false;
        const legal = this.game.legalActions().filter((a: any) => a.creatureUid === cr.uid);
        const isMove = (a: any) => a.type === 'move';
        const swapAt = (a: any) => st.board.creatures.some((o: any) => o.row === a.row && o.col === a.col);
        this.setGlow(legal.filter((a: any) => isMove(a) && !swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow');
        this.setGlow(legal.filter((a: any) => isMove(a) && swapAt(a)).map((a: any) => ({ row: a.row, col: a.col })), 'glow-swap');
        this.setGlow(legal.filter((a: any) => a.type === 'attack').map((a: any) => this.cellOfTarget(a.target)), 'glow-attack');
        this.setGlow(legal.filter((a: any) => a.type === 'mine').map((a: any) => ({ row: a.row, col: a.col })), 'glow-mine');
        this.setGlow(legal.filter((a: any) => a.type === 'ability' && this.abilityCell(a, cr)).map((a: any) => this.abilityCell(a, cr)!), 'glow-swap');
        if (!legal.some((a: any) => a.type === 'move' || (a.type === 'ability' && this.abilityCell(a, cr)) || a.type === 'attack' || a.type === 'mine')) this.flash(st.phase === 'action' ? 'This creature cannot act now (each creature moves, attacks OR mines)' : 'Creatures move and attack in the Action phase');
        return true;
      },
      onDrop: (c) => { if (c) this.unitActAt(cr, c); },
      onTap: () => {
        this.view?.poke(cr.uid);
        // Owner (Oct 25): a left click uses the unit; the card opens with the right button (a touch tap on an enemy still shows its card)
        if (mine) {
          this.abilityMenu(cr);
          this.selectUnit(cr);
          if (!this.pick && !document.querySelector('.ability-menu')) {
            if (e.pointerType !== 'mouse' && this.popups && !this.dialogs.length) this.showCard(cr.cardId, cr);
            else this.flash(st.phase === 'action' && st.priority === 'player' ? 'This creature cannot act now' : 'Creatures move and attack in your Action phase');
          }
        } else if (e.pointerType !== 'mouse' && this.popups && !this.dialogs.length) this.showCard(cr.cardId, cr);
      },
    });
  }

  /** Board cell a special ability is aimed at when dragging its creature (null = chosen from the tap menu). */
  abilityCell(a: any, cr: any): { row: number; col: number } | null {
    switch (a.ability) {
      case 'slide': case 'ramMove': case 'rocket': return a.target;
      case 'bowl': return { row: cr.row + a.dr, col: cr.col + a.dc };
      case 'plow': return { row: cr.row + a.dr * a.dist, col: cr.col + a.dc * a.dist };
      case 'shaman': return a.from;
      default: return null;
    }
  }
  /** Junk Shaman: drop on a character; ally goes toward the enemy Stronghold, enemy is yanked away from it. */
  bestShaman(opts: any[], cr: any): any {
    const st = this.game.state;
    const src = st.board.creatures.find((o: any) => o.row === opts[0]?.from.row && o.col === opts[0]?.from.col);
    const eh = SH.opponent;
    const d = (q: any) => Math.max(Math.abs(q.row - eh.row), Math.abs(q.col - eh.col));
    const ally = src && src.owner === cr.owner;
    return opts.slice().sort((x: any, y: any) => (ally ? d(x.target) - d(y.target) : d(y.target) - d(x.target)))[0];
  }
  /** Tap menu for abilities that are not aimed by dragging (Shockwave, Ward, Sacrifice). */
  abilityMenu(cr: any) {
    document.querySelector('.ability-menu')?.remove();
    if (this.game.state.phase !== 'action' || this.game.state.priority !== 'player') return;
    const opts = this.game.legalActions().filter((a: any) => a.type === 'ability' && a.creatureUid === cr.uid && ['shockwave', 'ward', 'sacrifice'].includes(a.ability));
    if (!opts.length) return;
    const NAME: Record<string, string> = { shockwave: 'Shockwave (1)', ward: 'Ward an ally (2)', sacrifice: 'Sacrifice an ally (+1 Bank)' };
    const menu = h('div', { class: 'ability-menu', role: 'menu', 'aria-label': 'Abilities' });
    for (const a of opts.slice(0, 8)) {
      const t = a.target ? this.game.state.board.creatures.find((o: any) => o.row === a.target.row && o.col === a.target.col) : null;
      const label = NAME[a.ability] + (t ? ` — ${CARDS[t.cardId].name} (${t.row},${t.col})` : '');
      menu.append(h('button', { type: 'button', role: 'menuitem', class: 'txtbtn', onclick: () => { menu.remove(); const r = this.game.act(a); if (!r.ok) this.flash(r.error!); } }, label));
    }
    menu.append(h('button', { type: 'button', class: 'txtbtn', onclick: () => menu.remove() }, 'Cancel'));
    document.body.append(menu);
  }
}
