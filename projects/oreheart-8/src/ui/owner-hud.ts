/// <reference types="vite/client" />
// The owner's match-screen layout (round 9a): data from owner-layout.json, themes per faction from content/themes/*.json.
import layout from '../content/owner-layout.json';

type El = HTMLElement;
const themeFiles = import.meta.glob('../content/themes/*.json', { eager: true }) as Record<string, any>;
/** Faction themes, one data file each. A faction without a file uses the Goblin pieces that the owner marked as placeholders. */
export const THEMES: Record<string, any> = {};
for (const [p, m] of Object.entries(themeFiles)) THEMES[p.split('/').pop()!.replace('.json', '')] = (m as any).default ?? m;
const FALLBACK = 'goblins';
export const hasTheme = (faction: string) => !!THEMES[faction];
export const themeOf = (faction: string) => THEMES[faction] || THEMES[FALLBACK];
const dir = (faction: string) => (THEMES[faction] ? faction : FALLBACK);
const picUrl = (name: string) => `/art/goblin/${name}`;

const HUD: any[] = (layout as any).hud;
export const piece = (role: string) => HUD.find((p) => p.role === role);

/** Text style from a layout text block (size is % of screen height). */
function textCss(t: any, ts: number) {
  const sh = t.shadow ?? 0, gl = t.glow ?? 0;
  const parts = [`0 ${0.06 * sh}em ${0.12 * sh}em #000`, `0 0 ${0.04 * sh}em #000`];
  if (gl) parts.push(`0 0 ${0.18 * gl}em ${t.glowColor || '#000'}`);
  return { color: '#ffffff', fontWeight: t.bold ? '700' : '400', fontStyle: t.italic ? 'italic' : 'normal', textAlign: t.align === 'center' ? 'center' : t.align === 'right' ? 'right' : 'left', textShadow: parts.join(','), sizePct: (t.size || 2) * ts };
}

export interface HudHooks {
  playerFaction: string; enemyFaction: string;
  menuItems: { label: string; run: () => void }[];
  closeMenu: () => void;
}

/** Re-places every piece for the current window (16:9 stage, pieces anchored to the nearest screen edge). */
export function applyOwnerHud(match: El, r: any, hk: HudHooks) {
  const ts = (layout as any).textScale || 1;
  const placed: { el: El; spec: any }[] = [];
  const add = (el: El, role: string, extra?: Partial<any>) => {
    const spec = { ...piece(role), ...extra };
    el.classList.add('o-piece');
    el.dataset.role = role;
    el.dataset.hudRole = role || spec.id || '';
    match.append(el);
    placed.push({ el, spec });
    return el;
  };
  const txt = (el: El, spec: any) => {
    const t = textCss(spec.text, ts);
    el.classList.add('o-text');
    el.style.setProperty('--oc', t.color); el.style.setProperty('--ow', t.fontWeight); el.style.setProperty('--os', t.fontStyle); el.style.color = t.color; el.style.fontWeight = t.fontWeight; el.style.fontStyle = t.fontStyle; el.style.textAlign = t.textAlign; el.style.textShadow = t.textShadow;
    el.dataset.size = String(t.sizePct);
    el.style.justifyContent = spec.text.align === 'center' ? 'center' : spec.text.align === 'right' ? 'flex-end' : 'flex-start';
  };
  const img = (src: string, cls = '') => { const i = document.createElement('img'); i.src = src; i.alt = ''; i.draggable = false; i.className = 'o-img ' + cls; return i; };
  const pt = themeOf(hk.playerFaction), pd = dir(hk.playerFaction);
  void pd;
  const goblin = (f: string) => !!THEMES[f];

  // corner frames (the player's faction theme)
  (goblin(hk.playerFaction) ? pt.cornerFrames : []).forEach((f: any, i: number) => {
    const el = document.createElement('div'); el.className = 'o-frame'; el.setAttribute('aria-hidden', 'true');
    const im = img(picUrl(f.picture[0]));
    if (f.mirror) im.style.transform = 'scaleX(-1)';
    el.append(im);
    el.style.zIndex = String(1 + i);
    add(el, '', { x: f.x, y: f.y, w: f.w, h: f.h });
    el.dataset.role = 'corner-frame-' + (i + 1); el.dataset.hudRole = ['pic2', 'pic3', 'pic4'][i] || 'pic' + (i + 2); el.dataset.cornerFrame = '1'; el.dataset.ornament = 'corner';
  });

  // Flow crystals (picture + number); the bank is its own piece
  const gem = (role: string, side: 'player' | 'enemy', numEl: El, label: string) => {
    const spec = piece(role);
    const f = side === 'player' ? hk.playerFaction : hk.enemyFaction;
    const pic = goblin(f) ? themeOf(f).flowCrystal.player.picture[0] : themeOf(FALLBACK).flowCrystal.opponentPlaceholder.picture[0];
    const el = document.createElement('div'); el.className = 'o-gem'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
    const gi = img(picUrl(pic)); gi.setAttribute('role', 'img'); gi.setAttribute('aria-label', side === 'player' ? 'Your soul crystal' : 'Enemy soul crystal'); gi.alt = gi.getAttribute('aria-label')!;
    el.append(gi);
    numEl.classList.add('o-gem-n');
    numEl.style.fontSize = `max(14px, calc(var(--u) * ${spec.gem.numSize} * 9 / 100))`;
    el.append(numEl);
    el.style.zIndex = '4';
    add(el, role);
    return el;
  };
  gem('player-flow-crystal', 'player', r.crFlow, 'Your crystal');
  gem('enemy-flow-crystal', 'enemy', r.eFlow, 'Enemy crystal');

  // banks: own pieces with the number on top
  const bank = (role: string, numEl: El, faction: string, label: string) => {
    const spec = piece(role);
    const el = document.createElement('div'); el.className = 'o-bank'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', label);
    numEl.setAttribute('aria-label', label + ' crystals');
    el.append(img(goblin(faction) ? '/art/ui/goblin-bank.png' : '/art/ui/opponent-bank-placeholder.png'));
    numEl.classList.add('o-bank-n');
    const b = spec.bank;
    numEl.style.fontSize = `max(14px, calc(var(--u) * ${b.numSize} * 9 / 100))`;
    numEl.style.color = b.numColor;
    numEl.style.translate = `${b.nx}% ${b.ny}%`;
    numEl.style.textShadow = b.numGlow ? `0 0 ${0.25 * b.numGlow}em ${b.numGlowColor}, 0 1px 2px #000` : '0 1px 2px #000';
    el.append(numEl);
    el.style.zIndex = '5';
    add(el, role);
  };
  bank('player-bank', r.crBank, hk.playerFaction, 'Your Bank');
  bank('enemy-bank', r.eBank, hk.enemyFaction, 'Enemy Bank');

  // text pieces
  const textPiece = (el: El, role: string) => { txt(el, piece(role)); el.style.zIndex = String(10 + (piece(role).z ?? 0)); add(el, role); };
  textPiece(r.myName, 'player-name');
  r.myName.classList.add('o-name');
  const wordP = document.createElement('span'); wordP.textContent = 'Flow'; textPiece(wordP, 'player-flow-label');
  textPiece(r.income, 'player-next-flow');
  textPiece(r.eName, 'enemy-name');
  const wordE = document.createElement('span'); wordE.textContent = 'Flow'; textPiece(wordE, 'enemy-flow-label');
  textPiece(r.eNext, 'enemy-next-flow');
  // phase pieces: the children of the phase element are placed individually
  const turn = r.phase.querySelector('.ph-turn') as El, steps = r.phase.querySelector('.ph-steps') as El, time = r.phase.querySelector('.ph-time') as El;
  r.phase.classList.add('o-phase');
  const prs = ['turn-banner', 'phase-list', 'phase-timer'].map(piece);
  const ux = Math.min(...prs.map((p) => p.x)), uy = Math.min(...prs.map((p) => p.y));
  const uw = Math.max(...prs.map((p) => p.x + p.w)) - ux, uh = Math.max(...prs.map((p) => p.y + p.h)) - uy;
  r.phase.style.zIndex = '10';
  add(r.phase, 'phase-display', { x: ux, y: uy, w: uw, h: uh, rot: 0 });
  for (const [el, role] of [[turn, 'turn-banner'], [steps, 'phase-list'], [time, 'phase-timer']] as [El, string][]) { txt(el, piece(role)); el.style.zIndex = '10'; add(el, role); (el as any)._par = r.phase; r.phase.append(el); }

  // decks
  const deck = (el: El, role: string, countRole: string, rot: number) => {
    const spec = piece(role), c = piece(countRole), n = el.querySelector('.pile-n') as El;
    el.classList.add('o-deck');
    if (rot) el.style.setProperty('--rot', rot + 'deg');
    const t = textCss(c.text, ts);
    n.style.cssText = `left:${c.x}%;top:${c.y}%;width:${c.w}%;height:${c.h}%;rotate:${c.rot || 0}deg;color:${t.color};font-weight:${t.fontWeight};--ow:${t.fontWeight};--os:italic;font-style:italic;text-shadow:${t.textShadow}`;
    n.dataset.size = String(t.sizePct); n.dataset.role = countRole; n.dataset.hudRole = countRole;
    el.style.zIndex = '7';
    add(el, role);
    void spec;
  };
  deck(r.enemyDeck, 'enemy-deck', 'enemy-deck-count', piece('enemy-deck').rot);
  deck(r.myDeck, 'player-deck', 'player-deck-count', 0);
  r.enemyHand.classList.add('o-fan'); r.enemyHand.style.zIndex = '6'; r.enemyHand.style.setProperty('--rot', piece('enemy-hand').rot + 'deg');
  add(r.enemyHand, 'enemy-hand');

  // the hand keeps its own vertical tuck; its horizontal box comes from the layout
  r.hand.classList.add('o-hand'); r.hand.dataset.role = 'player-hand';
  placed.push({ el: r.hand, spec: piece('player-hand') });

  // Done and Menu as plain text
  txt(r.done, piece('done-button')); r.done.style.zIndex = '40'; r.done.style.setProperty('--oc', '#fff'); add(r.done, 'done-button');
  const mb = piece('menu-button');
  txt(r.menuWrap, mb);
  r.menuWrap.classList.add('o-menu');
  r.menuWrap.dataset.role = 'menu-button'; r.menuWrap.dataset.hudRole = 'menu-button';
  placed.push({ el: r.menuWrap, spec: mb });
  r.menuWrap.classList.add('o-piece');
  r.menuWrap.style.zIndex = '60';
  // small always-visible speaker (bottom-left corner of the screen) so sound can be muted without opening the Menu
  if (r.spk) { r.spk.style.cssText = 'position:fixed;left:.5%;bottom:1%;top:auto;z-index:10000'; match.append(r.spk); }
  match.append(r.menuWrap);

  // drop-down menu
  const ms = mb.menu;
  const panel = r.menuPanel as El;
  panel.className = 'o-menu-panel'; panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', 'Match menu');
  panel.replaceChildren(...hk.menuItems.map((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'o-menu-item'; b.setAttribute('role', 'menuitem'); b.textContent = it.label.replace(/\s+/g, ' ');
    b.style.setProperty('--i', String(i));
    b.addEventListener('click', () => { hk.closeMenu(); it.run(); });
    return b;
  }));

  const relayout = () => {
    const W = match.clientWidth || window.innerWidth, H = match.clientHeight || window.innerHeight;
    const u = Math.min(W / 16, H / 9);
    match.style.setProperty('--u', u + 'px');
    match.style.setProperty('--ms', String(ms.size));
    const sw = 16 * u, sh = 9 * u;
    const origin = new Map<El, [number, number]>();
    for (const { el, spec } of placed) {
      const w = (spec.w / 100) * sw, hh = (spec.h / 100) * sh;
      const cx = spec.x + spec.w / 2, cy = spec.y + spec.h / 2;
      const offX = W > sw ? (cx < 33.33 ? 0 : cx > 66.67 ? W - sw : (W - sw) / 2) : 0;
      const offY = H > sh ? (cy < 33.33 ? 0 : cy > 66.67 ? H - sh : (H - sh) / 2) : 0;
      const left = offX + (spec.x / 100) * sw, top = offY + (spec.y / 100) * sh;
      (el as any)._rect = { x: left, y: top, width: w, height: hh };
      origin.set(el, [left, top]);
      const po = (el as any)._par ? origin.get((el as any)._par) : null;
      el.style.setProperty('--pl', left - (po ? po[0] : 0) + 'px'); el.style.setProperty('--pt', top - (po ? po[1] : 0) + 'px'); el.style.setProperty('--pw', w + 'px'); el.style.setProperty('--ph', hh + 'px');
      if (spec.rot && !el.classList.contains('o-deck') && !el.classList.contains('o-fan')) el.style.setProperty('--rot', spec.rot + 'deg');
      if (el.dataset.size) el.style.fontSize = Math.max(14, (+el.dataset.size / 100) * sh) + 'px';
    }
    match.querySelectorAll<El>('.o-deck .pile-n').forEach((n) => { n.style.fontSize = Math.max(14, (+n.dataset.size! / 100) * sh) + 'px'; });
    // menu look (sizes are % of screen height)
    const f = (v: number) => (v / 100) * sh + 'px';
    panel.style.cssText = `--mfs:${Math.max(14, (ms.size / 100) * sh)}px;--mgap:${f(ms.gap)};--mpad:${f(ms.pad)};--mrad:${f(ms.radius)};--mw:${Math.max(180, (ms.width / 100) * sw)}px;--mc:#ffffff;--mhc:#ffffff;--mhg:${ms.hoverGlowColor};--mhgs:${ms.hoverGlow};--mgrow:${ms.grow};--mslide:${ms.slide};--mbg:${ms.bg};--mbga:${ms.bgA};--mspeed:${ms.speed}ms;--mstag:${ms.stagger}ms;top:calc(100% + ${f(ms.offset)});`;
  };
  const layoutInfo = () => {
    const W = match.clientWidth || window.innerWidth, H = match.clientHeight || window.innerHeight;
    const fw = Math.min(W, (H * 16) / 9), fh = (fw * 9) / 16;
    const rotOf = (e: El | null): number => { let a = 0; for (; e && e !== match; e = e.parentElement) { const r = parseFloat(getComputedStyle(e).rotate); if (!isNaN(r)) a += r; } return a; };
    const pieces: any[] = [];
    const seen = new Set<El>();
    const all = [...placed.map((x) => x.el), ...match.querySelectorAll<El>('.pile-n[data-hud-role]')];
    for (const el of all) {
      if (seen.has(el) || !el.isConnected || (el as any).hidden) continue;
      seen.add(el);
      const role = el.dataset.role || '', id = el.dataset.hudRole || role;
      const lay = HUD.find((p) => (role && p.role === role) || p.id === id);
      const rr = (el as any)._rect || (() => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })();
      const im = el.querySelector('img') as HTMLImageElement | null;
      pieces.push({ id: lay?.id || id, role: lay?.role || role, kind: lay?.kind || 'pic', rect: rr, rot: rotOf(el), z: lay?.z ?? 0, src: im ? im.getAttribute('src') : null });
    }
    return { frame: { x: (W - fw) / 2, y: (H - fh) / 2, width: fw, height: fh }, pieces };
  };
  relayout();
  (match as any)._hudInfo = layoutInfo;
  new ResizeObserver(relayout).observe(match);
  window.addEventListener('resize', relayout);
  return { relayout };
}
