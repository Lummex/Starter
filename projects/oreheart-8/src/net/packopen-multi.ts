// Opening several packs at once (Ken, Nov 5: "give them a slider how many they want to open at one time"): one big rip of
// the whole stack, then every card in a grid, rarest first, with the Rare-or-better and the upgraded ones lit; a bundle's
// guaranteed extras and a bad-luck-shield card wear their tag. The server already dealt and granted everything (open_stash).
import { h, pictureOf, rarityKey, commanderPortrait } from '../ui/app';
import { ohCardEl, cardFor, rarityLabel } from '../ui/cardfmt';
import { TIER_NAMES } from '../content/card-labels';
import { econShow, coinChip, backBtn, toast, isTestPage, type PackInfo, type OpenResult, type PulledCard } from './economy';
import { sealedPack } from './packopen';
import { audio } from '../ui/audio';

type El = HTMLElement;
export interface MultiOpts { pack: PackInfo | null; openings: OpenResult[]; onDone: () => void; chest?: boolean }
type Shown = PulledCard & { from: number; extra: boolean };
const RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, 'ultra-rare': 3, collector: 4 };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const smallDevice = () => typeof matchMedia !== 'undefined' && matchMedia('(max-height:480px), (pointer:coarse)').matches;

let current: MultiScene | null = null;
let chestBuf: AudioBuffer | null | undefined;
export const chestSfxLog: number[] = [];
/** Brush's chest-open.ogg (2.4 s), quiet, through the game's own audio context; nothing when muted */
function playChest() {
  chestSfxLog.push(Math.round(performance.now()));
  const ctx = audio.ctx;
  const v = audio.muted ? 0 : (audio.sfx / 100) * 0.8;
  if (!ctx || !v) return;
  const go = (b: AudioBuffer) => { const g = ctx.createGain(); g.gain.value = v; g.connect(ctx.destination); const s = ctx.createBufferSource(); s.buffer = b; s.connect(g); s.start(); };
  if (chestBuf) { go(chestBuf); return; }
  if (chestBuf === null) return;
  chestBuf = null;
  fetch('/art/packs/sfx/chest-open.ogg').then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => { chestBuf = b; go(b); }, () => { chestBuf = null; });
}

class MultiScene {
  phase: 'idle' | 'ripping' | 'done' = 'idle';
  root: El;
  cards: Shown[];
  private stage: El; private stack: El; private shredBox: El; private grid: El; private hint: El; private summary: El;
  private ripBtn: HTMLButtonElement; private doneBtn: HTMLButtonElement; private backBtn: HTMLButtonElement;
  private T: number;
  private chest: boolean;
  private chestOpen: El | null = null; private chestLid: El | null = null;
  constructor(private o: MultiOpts) {
    this.T = reduced() ? 0.3 : 1;
    const p = o.pack;
    // the 99 chest (or any bundle that carries the chest card back) opens as Brush's treasure chest
    this.chest = o.chest === true || o.openings.length >= 99 || o.openings.some((op) => (op.extras || []).some((e) => e.guarantee === 'card_back'));
    const all: Shown[] = [];
    o.openings.forEach((op, i) => {
      for (const c of op.extras || []) all.push({ ...c, from: i, extra: true });
      for (const c of op.cards) all.push({ ...c, from: i, extra: false });
    });
    // rarest first; an upgraded card sits with its rarity but ahead of plain ones; guaranteed extras lead
    const rank = (c: Shown) => (c.guarantee === 'card_back' ? 99 : (c.extra ? 50 : 0) + (RANK[rarityKey({ rarity: c.rarity })] ?? 0) * 10 + Math.min(5, Number(c.tier) || 1));
    all.sort((a, b) => rank(b) - rank(a) || String(a.card_id).localeCompare(String(b.card_id)));
    this.cards = all;
    const n = o.openings.length;
    if (this.chest) {
      this.chestOpen = h('img', { class: 'chest-open', src: '/art/packs/chest/chest-open.webp', alt: '', draggable: 'false', hidden: true }) as El;
      this.chestLid = h('img', { class: 'chest-lid', src: '/art/packs/chest/chest-lid.webp', alt: '', draggable: 'false', hidden: true }) as El;
      this.stack = h('div', { class: 'pkm-stack pkm-chest', role: 'button', tabindex: '0', 'aria-label': `Open the treasure chest: ${n} packs`, 'data-testid': 'chest-stage' },
        h('div', { class: 'pkm-aura', 'aria-hidden': 'true' }),
        h('img', { class: 'chest-closed', src: '/art/packs/chest/chest-closed.webp', alt: '', draggable: 'false' }),
        h('img', { class: 'chest-glow', src: '/art/packs/chest/chest-glow.webp', alt: '', draggable: 'false', 'aria-hidden': 'true' }),
        this.chestOpen, this.chestLid,
        h('span', { class: 'pkm-count', 'aria-hidden': 'true' }, `×${n}`));
    } else {
      this.stack = h('div', { class: 'pkm-stack', role: 'button', tabindex: '0', 'aria-label': `Rip open ${n} ${p?.name || 'pack'}s` },
        h('div', { class: 'pkm-aura', 'aria-hidden': 'true' }),
        ...[3, 2, 1].map((k) => { const s = sealedPack(p, `pkm-s${k}`); s.setAttribute('aria-hidden', 'true'); return s; }),
        h('span', { class: 'pkm-count', 'aria-hidden': 'true' }, `×${n}`));
    }
    this.shredBox = h('div', { class: 'pko-shreds pkm-shreds', 'aria-hidden': 'true' });
    this.stage = h('div', { class: 'pkm-stage' }, this.stack, this.shredBox);
    this.grid = h('div', { class: 'pkm-grid', role: 'list', 'aria-label': 'Your cards', hidden: true });
    this.summary = h('p', { class: 'pkm-summary', 'data-testid': 'multi-summary' });
    this.hint = h('p', { class: 'pko-hint', 'aria-live': 'polite' }, this.chest ? `A treasure chest with ${n} packs inside. Tap it to open.` : `${n} sealed packs. Tap the stack to rip them all open.`);
    this.ripBtn = h('button', { type: 'button', class: 'net-btn primary pko-rip-btn pkm-rip', onclick: () => { void this.rip(); } }, this.chest ? 'Open the chest!' : 'Rip them all open!') as HTMLButtonElement;
    this.doneBtn = h('button', { type: 'button', class: 'net-btn primary pko-done', hidden: true, onclick: () => { this.close(); o.onDone(); } }, 'Done') as HTMLButtonElement;
    this.backBtn = backBtn(() => { this.close(); o.onDone(); toast('Your cards are safe in your Collection.', '/art/packs/icons/free-pack.webp'); }) as HTMLButtonElement;
    this.backBtn.classList.add('pko-leave');
    this.root = econShow('pack', h('div', { class: 'pko-scene pkm-scene', 'data-phase': 'idle', 'data-testid': 'multi-scene', 'data-count': String(n) },
      h('div', { class: 'pko-head' }, this.backBtn, h('h1', { class: 'pko-title' }, this.chest ? `Treasure chest: ${n} × ${p?.name || 'Oreheart Pack'}` : `${n} × ${p?.name || 'Oreheart Pack'}`), coinChip()),
      this.stage, this.summary, this.grid,
      h('div', { class: 'pko-ui' }, this.hint, h('div', { class: 'net-actions' }, this.ripBtn, this.doneBtn))));
    this.root.classList.add('pko-screen', 'pkm-screen');
    if (this.chest) this.root.classList.add('pkm-screen-chest');
    this.stack.addEventListener('click', () => { void this.rip(); });
    this.stack.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void this.rip(); } });
    this.buildGrid();
  }
  private scene() { return this.root.querySelector('.pko-scene') as El; }
  private setPhase(p: 'idle' | 'ripping' | 'done') { this.phase = p; this.scene().dataset.phase = p; }
  state() { return { phase: this.phase, count: this.cards.length, packs: this.o.openings.length, shown: this.grid.hidden ? 0 : this.grid.children.length }; }

  private buildGrid() {
    this.grid.replaceChildren(...this.cards.map((c, i) => {
      if (c.guarantee === 'card_back') {
        return h('div', { class: 'pkm-card pkm-back pkm-hi', role: 'listitem', 'data-guarantee': 'card_back', style: `--i:${i}` },
          h('img', { class: 'pkm-back-art', src: '/art/packs/chest/chest-card-back.webp', alt: 'the chest card back', draggable: 'false' }), h('span', { class: 'pkm-tag pkm-tag-g' }, 'GUARANTEED'), h('span', { class: 'pkm-name' }, 'Chest card back unlocked'));
      }
      const card: any = cardFor(c.card_id);
      const rk = rarityKey({ rarity: c.rarity || (card && card.rarity) });
      const tier = Math.max(1, Math.min(5, Number(c.tier) || 1));
      const art = card && card.type === 'commander' && card.commanderId ? commanderPortrait(card.commanderId) : pictureOf(card);
      const hi = (RANK[rk] ?? 0) >= 2 || tier > 1 || !!c.guarantee || !!c.pity;
      const name = card ? `${card.name}, ${rarityLabel(c.rarity || card.rarity)}${tier > 1 ? ', ' + TIER_NAMES[tier] + ' (upgraded)' : ''}${c.is_new ? ', new' : ''}${c.guarantee ? ', guaranteed' : ''}${c.pity ? ', bad-luck shield' : ''}` : c.card_id;
      const el = h('div', { class: `pkm-card pko-r-${rk}${hi ? ' pkm-hi' : ''}${tier > 1 ? ' pkm-upg' : ''}`, role: 'listitem', tabindex: '0', 'aria-label': name, 'data-card-id': c.card_id, 'data-rarity': rk, 'data-tier': String(tier), 'data-guarantee': c.guarantee || null, 'data-pity': c.pity ? 'true' : null, 'data-new': c.is_new ? 'true' : null, style: `--i:${i}` },
        card ? ohCardEl({ ...card, rarity: c.rarity || card.rarity, tier }, art) : h('div', { class: 'pko-unknown' }, c.card_id),
        c.guarantee ? h('span', { class: 'pkm-tag pkm-tag-g' }, 'GUARANTEED') : c.pity ? h('span', { class: 'pkm-tag pkm-tag-p' }, 'BAD-LUCK SHIELD') : null,
        tier > 1 ? h('span', { class: 'pkm-tag pkm-tag-u', 'data-tier': String(tier) }, TIER_NAMES[tier].toUpperCase()) : null,
        c.is_new ? h('span', { class: 'pko-new', 'aria-hidden': 'true' }, 'NEW') : null);
      const zoom = () => { if (card) zoomCard({ ...card, rarity: c.rarity || card.rarity, tier }, art); };
      el.addEventListener('click', zoom);
      el.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoom(); } });
      return el;
    }));
  }

  async rip() {
    if (this.phase !== 'idle') return;
    this.setPhase('ripping');
    this.hint.textContent = '';
    this.ripBtn.hidden = true;
    this.backBtn.hidden = true;
    const T = this.T;
    if (this.chest) { await this.openChest(); return; }
    this.stack.classList.add('pkm-shaking');
    const aura = this.stack.querySelector('.pkm-aura') as El;
    aura.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1.25)' }], { duration: 700 * T, fill: 'forwards', easing: 'ease-in' });
    await wait(700 * T);
    if ((this.phase as string) !== 'ripping') return;
    this.stack.classList.remove('pkm-shaking');
    if (!reduced()) {
      const flash = h('div', { class: 'pko-flash', 'aria-hidden': 'true' });
      this.root.append(flash);
      flash.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 320, easing: 'ease-out', fill: 'forwards' }).finished.then(() => flash.remove(), () => flash.remove());
      this.shreds(smallDevice() ? 40 : 90);
    }
    this.stack.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(-14%) scale(1.08)', opacity: 1, offset: 0.3 }, { transform: 'translateY(30%) scale(.7)', opacity: 0 }], { duration: 700 * T, fill: 'forwards', easing: 'ease-in' });
    await wait(600 * T);
    if ((this.phase as string) !== 'ripping') return;
    this.finish();
  }
  /** Brush's grand opening (art/packs/chest/README): the seam light pulses while the chest shakes, the latch clunks and the hinge
   *  creaks (chest-open.ogg, 0.2-1.05 s), the lid thumps open at 1.08 s and flies back around its hinge, the open chest shows the
   *  foil packs and the light, the scraps burst, then the cards. Transform and opacity only. */
  private async openChest() {
    const T = this.T;
    const glow = this.stack.querySelector('.chest-glow') as El;
    const closed = this.stack.querySelector('.chest-closed') as El;
    const aura = this.stack.querySelector('.pkm-aura') as El;
    this.stack.classList.add('pkm-shaking', 'pkm-chest-arming');
    glow.animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.45 }, { opacity: 1 }], { duration: 900 * T, fill: 'forwards', easing: 'ease-in-out' });
    aura.animate([{ opacity: 0, transform: 'scale(.7)' }, { opacity: 0.9, transform: 'scale(1.3)' }], { duration: 900 * T, fill: 'forwards', easing: 'ease-in' });
    await wait(900 * T);
    if ((this.phase as string) !== 'ripping') return;
    this.stack.classList.remove('pkm-shaking');
    playChest(); // the latch at 0, the creak from 0.2 s, the thump at 1.08 s
    await wait(200 * T);
    if ((this.phase as string) !== 'ripping') return;
    // the lid creaks up a little during the creak, then at the thump it flies back around its hinge and the open chest shows
    if (this.chestLid) { this.chestLid.hidden = false; this.chestLid.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-7deg)' }], { duration: 850 * T, fill: 'forwards', easing: 'ease-in-out' }); }
    await wait(880 * T);
    if ((this.phase as string) !== 'ripping') return;
    if (this.chestOpen) this.chestOpen.hidden = false;
    closed.style.opacity = '0'; glow.style.opacity = '0';
    if (!reduced()) {
      const flash = h('div', { class: 'pko-flash', 'aria-hidden': 'true' });
      this.root.append(flash);
      flash.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished.then(() => flash.remove(), () => flash.remove());
      this.shreds(smallDevice() ? 40 : 90);
    }
    if (this.chestLid) this.chestLid.animate([{ transform: 'rotate(-7deg)', opacity: 1 }, { transform: 'translateY(-18%) rotate(-24deg)', opacity: 1, offset: 0.4 }, { transform: 'translateY(-40%) rotate(-35deg)', opacity: 0 }], { duration: 700 * T, fill: 'forwards', easing: 'cubic-bezier(.2,.7,.3,1)' });
    this.stack.animate([{ transform: 'translateY(2%) scale(1.03)' }, { transform: 'none' }], { duration: 320 * T, easing: 'ease-out' });
    await wait(1300 * T); // a beat with the treasure showing (the warm chord), then the cards
    if ((this.phase as string) !== 'ripping') return;
    this.finish();
  }
  /** Foil scraps burst from the stack (transform and opacity only), about 1.5 s, then gone. */
  private shreds(n: number) {
    const box = this.shredBox;
    const r = box.getBoundingClientRect();
    const T = this.T;
    for (let i = 0; i < n; i++) {
      const s = h('img', { class: 'pko-shred', src: `/art/packs/shred-${(i % 6) + 1}.webp`, alt: '' });
      const size = Math.max(16, r.height * (0.04 + Math.random() * 0.1));
      s.style.width = s.style.height = size.toFixed(0) + 'px';
      s.style.left = (r.width * (0.3 + Math.random() * 0.4) - size / 2).toFixed(0) + 'px';
      s.style.top = (r.height * 0.4 - size / 2).toFixed(0) + 'px';
      box.append(s);
      const vx = (Math.random() - 0.5) * r.width * 2.6, vy = -(0.6 + Math.random() * 1.1) * r.height, g = r.height * 2.4, spin = (Math.random() - 0.5) * 1600;
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 6; k++) { const t = k / 6, sec = t * 1.2; frames.push({ transform: `translate(${(vx * sec).toFixed(1)}px,${(vy * sec + 0.5 * g * sec * sec).toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg)`, opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 }); }
      s.animate(frames, { duration: (1200 + Math.random() * 600) * T, easing: 'linear', fill: 'forwards' }).finished.then(() => s.remove(), () => s.remove());
    }
  }
  private finish() {
    this.setPhase('done');
    this.stage.classList.add('pkm-gone');
    this.grid.hidden = false;
    const counts: Record<string, number> = {};
    let upg = 0, news = 0, bestTier = 1, pity = 0, extras = 0;
    for (const c of this.cards) {
      if (c.guarantee === 'card_back') { extras++; continue; }
      if (c.guarantee) extras++;
      const rk = rarityKey({ rarity: c.rarity });
      counts[rk] = (counts[rk] || 0) + 1;
      const t = Number(c.tier) || 1;
      if (t > 1) { upg++; bestTier = Math.max(bestTier, t); }
      if (c.is_new) news++;
      if (c.pity) pity++;
    }
    const parts = [counts.collector ? `${counts.collector} Legendary` : '', counts['ultra-rare'] ? `${counts['ultra-rare']} Ultra Rare` : '', counts.rare ? `${counts.rare} Rare` : '', upg ? `${upg} upgraded` : '', news ? `${news} new` : ''].filter(Boolean);
    this.summary.textContent = `${this.o.openings.length} packs, ${this.cards.filter((c) => c.guarantee !== 'card_back').length} cards: ${parts.length ? parts.join(', ') : 'all Common and Uncommon this time'}.${extras ? ` Guarantee kept: ${extras} extra${extras === 1 ? '' : 's'}.` : ''}${pity ? ' The bad-luck shield stepped in.' : ''}`;
    this.hint.textContent = bestTier > 1 ? `UPGRADED! A ${TIER_NAMES[bestTier]} card is in there. Tap any card to see it big.` : counts.collector ? 'A LEGENDARY! Tap any card to see it big.' : 'Tap any card to see it big.';
    // the upgraded moment, once, for the best one (the tier's colour floods the screen)
    if (bestTier > 1 && !reduced()) {
      const flash = h('div', { class: 'pko-flash pko-flash-upg', 'data-tier': String(bestTier), 'aria-hidden': 'true' });
      this.root.append(flash);
      flash.animate([{ opacity: 0 }, { opacity: bestTier >= 4 ? 0.55 : 0.32, offset: 0.25 }, { opacity: 0 }], { duration: 900 * this.T, easing: 'ease-out', fill: 'forwards' }).finished.then(() => flash.remove(), () => flash.remove());
    }
    this.doneBtn.hidden = false;
    this.backBtn.hidden = true;
  }
  /** Jumps past the animation to the grid. */
  skip() {
    if (this.phase === 'done') return;
    for (const a of this.root.getAnimations({ subtree: true } as any)) { try { a.finish(); } catch { /* infinite */ } }
    this.shredBox.replaceChildren();
    this.stack.classList.remove('pkm-shaking');
    this.ripBtn.hidden = true;
    this.finish();
  }
  close() { this.root.remove(); if (current === this) current = null; }
}

/** A card, big (tap or Escape to close). */
function zoomCard(card: any, art: string | null) {
  const ov = h('div', { class: 'col-zoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': card.name, tabindex: '-1' }, h('div', { class: 'col-big' }, ohCardEl(card, art)));
  const close = () => ov.remove();
  ov.addEventListener('click', close);
  ov.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') close(); });
  document.body.append(ov);
  ov.focus();
}

/** Puts up the many-packs scene for a finished `open_stash` result. */
export function showMultiOpening(o: MultiOpts) {
  current?.close();
  current = new MultiScene(o);
  if (isTestPage()) (window as any).__ohMulti = { state: () => current?.state() ?? { phase: 'idle', count: 0, packs: 0, shown: 0 }, rip: () => current?.rip(), skip: () => current?.skip() };
  return current;
}
