// The pack opening (contract part 4.4). Ken: "I want a nice foil pack ... I want it to be animated when you open the pack. It rips open."
// Brush's painted foil packs (public/art/packs, README in the local art/packs folder) are stacked back to front:
// inside, a peeking card, body, the top strip, the sealed pack, the shine. The rip hides the sealed pack, swings the strip
// off around its right end, throws foil shreds, then the eight cards slide out face down into a row; the player flips them.
// Smooth on PC and phones: only transform and opacity move (Web Animations + CSS transitions), layout is read once per
// phase, never per frame. prefers-reduced-motion shortens everything and drops most of the shreds.
import { h, pictureOf, rarityKey } from '../ui/app';
import { CARDS } from '../engine';
import { ohCardEl, TIER_NAMES } from '../ui/cardfmt';
import { audio } from '../ui/audio';
import { packArtName, packArt } from './quest-summary';
export { packArtName, packArt };
import { econShow, coinChip, backBtn, toast, isTestPage, type PackInfo, type OpenResult, type PulledCard } from './economy';

type El = HTMLElement;
export type Phase = 'idle' | 'ripping' | 'cards' | 'done';


/** A sealed pack picture with the idle foil sheen (shop tiles reuse it). Falls back to a CSS foil if the art can't load. */
export function sealedPack(p: PackInfo | null, cls = ''): El {
  const name = packArtName(p);
  const wrap = h('div', { class: `pko-sealed-wrap ${cls}`.trim(), 'data-pack-art': name });
  const img = h('img', { class: 'pko-sealed', src: packArt(p), alt: p ? p.name : 'Pack', draggable: 'false' }) as HTMLImageElement;
  const shine = h('div', { class: 'pko-shine', 'aria-hidden': 'true' }, h('div', { class: 'pko-band' }));
  shine.style.setProperty('--mask', `url(${packArt(p, '-shine')})`);
  img.addEventListener('error', () => { wrap.classList.add('pko-css'); img.replaceWith(cssFoil(p)); });
  wrap.append(img, shine);
  return wrap;
}
/** Placeholder foil (only if the painted pack is missing): silver-crimped wrapper, midnight foil, the pack's name. */
function cssFoil(p: PackInfo | null, part: 'whole' | 'body' | 'top' = 'whole'): El {
  const tint = ({ goblin: '#2f7a3c', gnome: '#5a2f8a', dwarf: '#2a4a96', general: '#2c3f8f' } as Record<string, string>)[packArtName(p)];
  const el = h('div', { class: `pko-foil pko-foil-${part}`, style: `--tint:${tint}` }, part === 'top' ? null : h('span', { class: 'pko-foil-name' }, p?.name || 'Oreheart Pack'));
  return el;
}

// ------------------------------------------------------------------ sounds: Brush's synthesized files (CC0, small), quiet
const SFX = { rip: '/art/packs/sfx/rip.ogg', flip: '/art/packs/sfx/card-flip.ogg', crinkle: '/art/packs/sfx/crinkle.ogg', sting: '/art/packs/sfx/rare-sting.ogg' };
const bufs: Record<string, AudioBuffer | null> = {};
let loading: Promise<void> | null = null;
function loadSfx() {
  if (loading) return loading;
  const ctx = audio.ctx;
  if (!ctx) return Promise.resolve();
  loading = Promise.all(Object.entries(SFX).map(async ([k, url]) => {
    try { const r = await fetch(url); bufs[k] = await ctx.decodeAudioData(await r.arrayBuffer()); } catch { bufs[k] = null; }
  })).then(() => {});
  return loading;
}
export const sfxLog: { key: string; from: string; t: number }[] = [];
function play(key: keyof typeof SFX, vol = 0.7, delay = 0) {
  const ctx = audio.ctx;
  const v = audio.muted ? 0 : (audio.sfx / 100) * vol;
  sfxLog.push({ key, from: !ctx || !v ? 'muted' : bufs[key] ? 'file' : 'synth', t: Math.round(performance.now()) });
  if (!ctx || !v) return;
  const g = ctx.createGain(); g.gain.value = v; g.connect(ctx.destination);
  const t0 = ctx.currentTime + Math.max(0, delay);
  const b = bufs[key];
  if (b) { const s = ctx.createBufferSource(); s.buffer = b; s.connect(g); s.start(t0); return; }
  // synth stand-in (the audio.ts way): a short filtered noise burst for the rip/crinkle, a soft tick for the flip
  const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate); const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, key === 'flip' ? 8 : 2);
  const s = ctx.createBufferSource(); s.buffer = n;
  const f = ctx.createBiquadFilter(); f.type = key === 'flip' ? 'highpass' : 'bandpass'; f.frequency.value = key === 'flip' ? 2500 : 1800;
  s.connect(f); f.connect(g); g.gain.setValueAtTime(v * (key === 'flip' ? 0.5 : 0.8), t0); s.start(t0); s.stop(t0 + (key === 'flip' ? 0.12 : 0.35));
}

// ------------------------------------------------------------------ the scene
interface Opts { pack: PackInfo | null; result: OpenResult; canAgain: () => boolean; againLabel: () => string; onAgain: () => void; onDone: () => void }
const RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, 'ultra-rare': 3, collector: 4 };
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const smallDevice = () => typeof matchMedia !== 'undefined' && matchMedia('(max-height:480px), (pointer:coarse)').matches;

let current: Scene | null = null;

class Scene {
  phase: Phase = 'idle';
  flipped = 0;
  root: El;
  cards: PulledCard[];
  slots: El[] = [];
  private stage: El; private tilt: El; private wobble: El; private body: El; private top: El; private sealed: El; private peek: El; private shredBox: El; private row: El;
  private ripBtn: HTMLButtonElement; private flipAllBtn: HTMLButtonElement; private againBtn: HTMLButtonElement; private doneBtn: HTMLButtonElement; private hint: El;
  private skipping = false;
  private byKey = false;
  private backBtn: HTMLButtonElement;
  private T: number;
  constructor(private o: Opts) {
    this.cards = o.result.cards.slice(0, 8);
    this.T = reduced() ? 0.3 : 1;
    const p = o.pack;
    const name = packArtName(p);
    const img = (cls: string, src: string) => { const i = h('img', { class: cls, src, alt: '', draggable: 'false' }) as HTMLImageElement; return i; };
    this.peek = h('div', { class: 'pko-peek', 'aria-hidden': 'true' }, backFace(), backFace());
    this.body = img('pko-body', packArt(p, '-body'));
    this.top = img('pko-top', packArt(p, '-top'));
    this.sealed = sealedPack(p, 'pko-main');
    const inside = img('pko-inside', '/art/packs/pack-inside.webp');
    // missing art: CSS foil pieces cut along a jagged line instead
    (this.sealed.querySelector('img') as HTMLImageElement | null)?.addEventListener('error', () => {
      this.body.replaceWith(this.body = cssFoil(p, 'body')); this.body.classList.add('pko-body');
      this.top.replaceWith(this.top = cssFoil(p, 'top')); this.top.classList.add('pko-top');
      inside.style.visibility = 'hidden';
    });
    this.wobble = h('div', { class: 'pko-wobble' }, h('div', { class: 'pko-aura', 'aria-hidden': 'true' }), inside, this.peek, this.body, this.top, this.sealed);
    this.tilt = h('div', { class: 'pko-tilt', role: 'button', tabindex: '0', 'aria-label': `Rip open the ${p?.name || 'pack'}` }, this.wobble);
    this.shredBox = h('div', { class: 'pko-shreds', 'aria-hidden': 'true' });
    this.stage = h('div', { class: 'pko-stage', 'data-pack-art': name }, this.tilt, this.shredBox);
    this.row = h('div', { class: 'pko-row', role: 'group', 'aria-label': 'Your cards' });
    this.ripBtn = h('button', { type: 'button', class: 'net-btn primary pko-rip-btn', onclick: () => { void this.rip(); } }, 'Rip it open!') as HTMLButtonElement;
    this.flipAllBtn = h('button', { type: 'button', class: 'net-btn pko-flipall', hidden: true, onclick: () => { void this.flipAll(); } }, 'Flip all') as HTMLButtonElement;
    this.againBtn = h('button', { type: 'button', class: 'net-btn pko-again', hidden: true, onclick: () => { this.againBtn.disabled = true; o.onAgain(); } }, o.againLabel()) as HTMLButtonElement;
    this.doneBtn = h('button', { type: 'button', class: 'net-btn primary pko-done', hidden: true, onclick: () => { this.close(); o.onDone(); } }, 'Done') as HTMLButtonElement;
    this.hint = h('p', { class: 'pko-hint', 'aria-live': 'polite' }, 'Tap the pack to rip it open');
    // the way out before the rip. The server has already paid and rolled, so nothing is lost: the cards are in the Collection.
    this.backBtn = backBtn(() => { this.close(); o.onDone(); toast('Your cards are safe in your Collection.', '/art/packs/icons/free-pack.webp'); }) as HTMLButtonElement;
    this.backBtn.classList.add('pko-leave');
    const title = h('h1', { class: 'pko-title' }, p?.name || 'Oreheart Pack');
    this.root = econShow('pack', h('div', { class: 'pko-scene', 'data-phase': 'idle', 'data-testid': 'pack-scene' },
      h('div', { class: 'pko-head' }, this.backBtn, title, coinChip()),
      this.stage, this.row,
      h('div', { class: 'pko-ui' }, this.hint, h('div', { class: 'net-actions' }, this.ripBtn, this.flipAllBtn, this.againBtn, this.doneBtn))));
    this.root.classList.add('pko-screen');
    this.tilt.addEventListener('click', () => { void this.rip(); });
    this.tilt.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.byKey = true; void this.rip(); } });
    this.ripBtn.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') this.byKey = true; });
    // PC: the foil leans toward the mouse and the shine follows it (one transform per pointer move, nothing else)
    this.root.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.phase !== 'idle' || e.pointerType !== 'mouse') return;
      const u = e.clientX / innerWidth, v = e.clientY / innerHeight;
      this.tilt.style.transform = `rotateY(${((u - 0.5) * 22).toFixed(2)}deg) rotateX(${((0.5 - v) * 14).toFixed(2)}deg)`;
    });
    void loadSfx();
    this.buildRow();
  }
  private scene() { return this.root.querySelector('.pko-scene') as El; }
  private setPhase(p: Phase) { this.phase = p; this.scene().dataset.phase = p; }
  state() { return { phase: this.phase, flipped: this.flipped, cards: this.cards.map((c) => ({ ...c })) }; }

  private buildRow() {
    this.slots = this.cards.map((c, i) => {
      const card: any = (CARDS as any)[c.card_id];
      const rk = card ? rarityKey({ rarity: c.rarity || card.rarity }) : rarityKey({ rarity: c.rarity });
      const tier = Math.max(1, Math.min(5, Number(c.tier) || 1)); // Nov 5: an upgraded drop shows its tier art and stars
      const front = card ? ohCardEl({ ...card, rarity: c.rarity || card.rarity, tier }, pictureOf(card)) : h('div', { class: 'pko-unknown' }, c.card_id);
      const label = card ? `${card.name}, ${c.rarity}${tier > 1 ? ', ' + TIER_NAMES[tier] + ' (upgraded)' : ''}${c.is_new ? ', new' : ''}` : c.card_id;
      const slot = h('button', { type: 'button', class: `pko-card pko-r-${rk}`, 'data-i': String(i), 'data-card-id': c.card_id, 'data-rarity': rk, 'data-flipped': 'false', 'aria-label': `Card ${i + 1}, face down`, 'data-name': label, style: `--i:${i}` },
        h('div', { class: 'pko-glow', 'aria-hidden': 'true' }),
        h('div', { class: 'pko-flip' }, h('div', { class: 'pko-face pko-back' }, backFace()), h('div', { class: 'pko-face pko-front' }, front)),
        c.is_new ? h('span', { class: 'pko-new', 'aria-hidden': 'true' }, 'NEW') : null,
        tier > 1 ? h('span', { class: 'pko-upg', 'data-tier': String(tier), 'aria-hidden': 'true' }, TIER_NAMES[tier].toUpperCase()) : null);
      slot.dataset.tier = String(tier);
      if (tier > 1) slot.classList.add('pko-upgraded');
      slot.addEventListener('click', () => { if (slot.dataset.flipped === 'true') { if (card && performance.now() - (+(slot.dataset.flipAt || 0)) > 700) zoomCard({ ...card, rarity: c.rarity || card.rarity, tier }); return; } /* a double tap only flips */ if (this.phase === 'cards') this.flip(i); });
      return slot;
    });
    this.row.append(...this.slots);
  }

  async rip() {
    if (this.phase !== 'idle') return;
    this.setPhase('ripping');
    this.hint.textContent = '';
    this.ripBtn.hidden = true;
    this.backBtn.hidden = true;
    this.tilt.style.transform = '';
    const T = this.T;
    play('crinkle', 0.5);
    // 1. the build-up: the pack strains, shakes harder and harder, the glow swells
    this.wobble.classList.add('pko-shaking');
    const aura = this.wobble.querySelector('.pko-aura') as El;
    aura.animate([{ opacity: 0, transform: 'scale(.75)' }, { opacity: 1, transform: 'scale(1.16)' }], { duration: 640 * T, fill: 'forwards', easing: 'ease-in' });
    play('rip', 0.75, 0.22 * T); // Brush: the strip comes free 0.40 s into rip.ogg
    await wait(620 * T);
    if (this.skipping) return;
    // 2. the tear: the sealed pack and its shine vanish, the strip swings off around its right end
    this.wobble.classList.remove('pko-shaking');
    this.sealed.style.opacity = '0';
    this.tearFlash();
    this.top.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(10%,-34%) rotate(-22deg)', opacity: 1, offset: 0.28 }, { transform: 'translate(70%,-40%) rotate(-52deg)', opacity: 1, offset: 0.62 }, { transform: 'translate(135%,120%) rotate(-105deg)', opacity: 0 }], { duration: 950 * T, fill: 'forwards', easing: 'cubic-bezier(.3,.1,.5,1)' });
    aura.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 600 * T, fill: 'forwards' });
    this.shreds(reduced() ? 8 : smallDevice() ? 36 : 64);
    // 3. a beat with the pack torn open, then a card back rises inside the pack (never up over the title)
    await wait(240 * T);
    if (this.skipping) return;
    this.peek.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-6%)' }], { duration: 300 * T, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.3,1)' });
    await wait(340 * T);
    if (this.skipping) return;
    if (!reduced()) this.shreds(smallDevice() ? 8 : 16, true); // a last puff as the cards burst out
    // 4. the eight cards slide out into a row, face down; the empty pack sinks away
    const from = this.peek.getBoundingClientRect();
    this.setPhase('cards'); // the row takes its place now (it was hidden), so its boxes can be measured once
    const rects = this.slots.map((s) => s.getBoundingClientRect());
    this.stage.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(18%) scale(.85)' }], { duration: 500 * T, fill: 'forwards', easing: 'ease-in' });
    const anims = this.slots.map((s, i) => {
      const r = rects[i];
      const dx = from.left + from.width / 2 - (r.left + r.width / 2), dy = from.top + from.height / 2 - (r.top + r.height / 2);
      const sc = Math.min(1.2, from.width / Math.max(1, r.width));
      return s.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(${(i - 3.5) * 3}deg)`, opacity: 0 }, { opacity: 1, offset: 0.15 }, { transform: 'none', opacity: 1 }],
        { duration: 520 * T, delay: i * 70 * T, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
    });
    await Promise.all(anims.map((a) => a.finished.catch(() => {})));
    if (this.skipping) return;
    this.afterDeal();
  }
  private afterDeal() {
    this.stage.classList.add('pko-gone');
    this.flipAllBtn.hidden = false;
    this.hint.textContent = 'Tap a card to flip it';
    if (this.byKey) this.slots[0]?.focus({ preventScroll: true }); // keyboard players land on the first card; a mouse or a finger gets no focus ring
  }

  /** The moment of the tear: a white-hot line runs along the torn edge, a quick flash, the pack jolts. Transform and opacity only. */
  private tearFlash() {
    const T = this.T;
    const line = h('div', { class: 'pko-tearline', 'aria-hidden': 'true' });
    this.stage.append(line);
    line.animate([{ transform: 'scaleX(.05)', opacity: 1 }, { transform: 'scaleX(1.25)', opacity: 1, offset: 0.35 }, { transform: 'scaleX(1.4)', opacity: 0 }], { duration: 420 * T, easing: 'ease-out', fill: 'forwards' }).finished.then(() => line.remove(), () => line.remove());
    if (!reduced()) {
      const flash = h('div', { class: 'pko-flash', 'aria-hidden': 'true' });
      this.root.append(flash);
      flash.animate([{ opacity: 0.42 }, { opacity: 0 }], { duration: 240, easing: 'ease-out', fill: 'forwards' }).finished.then(() => flash.remove(), () => flash.remove());
      this.tilt.animate([{ transform: 'translateY(2.5%) scale(1.035)' }, { transform: 'translateY(-1%) scale(.99)', offset: 0.45 }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
    }
  }

  /** Foil shreds: sparkly scraps of every size burst from the torn edge, with gravity and spin, about 1.5 s, then gone. */
  private shreds(n: number, low = false) {
    const box = this.shredBox;
    const r = box.getBoundingClientRect();
    const T = this.T;
    const tinted = !smallDevice(); // the colour filter costs a little on each scrap: PC only
    for (let i = 0; i < n; i++) {
      const s = h('img', { class: 'pko-shred', src: `/art/packs/shred-${(i % 6) + 1}.webp`, alt: '' });
      const big = Math.random() < 0.25;
      const size = Math.max(20, r.height * (big ? 0.11 + Math.random() * 0.09 : 0.04 + Math.random() * 0.06));
      s.style.width = s.style.height = size.toFixed(0) + 'px';
      s.style.left = (r.width * (0.02 + Math.random() * 0.96) - size / 2).toFixed(0) + 'px';
      s.style.top = (r.height * (low ? 0.2 : 0.09) - size / 2).toFixed(0) + 'px';
      if (tinted && i % 3 === 1) s.style.filter = `hue-rotate(${Math.round(Math.random() * 360)}deg) saturate(1.6)`;
      box.append(s);
      const vx = (Math.random() - 0.5) * r.width * 2.2, vy = -(0.5 + Math.random() * 0.9) * r.height, g = r.height * 2.4, spin = (Math.random() - 0.5) * 1400;
      const frames: Keyframe[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6, sec = t * 1.2;
        frames.push({ transform: `translate(${(vx * sec).toFixed(1)}px,${(vy * sec + 0.5 * g * sec * sec).toFixed(1)}px) rotate(${(spin * t).toFixed(0)}deg) rotateX(${(spin * t * 0.7).toFixed(0)}deg)`, opacity: t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3 });
      }
      const a = s.animate(frames, { duration: (1200 + Math.random() * 600) * T, easing: 'linear', fill: 'forwards' });
      a.finished.then(() => s.remove(), () => s.remove());
    }
  }

  flip(i: number, quiet = false) {
    const s = this.slots[i];
    if (!s || s.dataset.flipped === 'true') return;
    s.dataset.flipped = 'true';
    s.dataset.flipAt = String(performance.now());
    s.classList.add('flipped');
    s.setAttribute('aria-label', s.dataset.name || 'Card');
    this.flipped += 1;
    const rk = s.dataset.rarity || 'common';
    if (!quiet) play('flip', 0.6);
    if (RANK[rk] >= 3 && !quiet) play('sting', 0.55, 0); // Ultra Rare and Collector only (Ken: fewer sounds)
    if (rk === 'collector' || rk === 'ultra-rare') setTimeout(() => this.burst(s, rk === 'collector' ? 16 : 8), 260 * this.T);
    const tier = Number(s.dataset.tier) || 1;
    if (tier > 1) this.upgradeMoment(s, tier, quiet); // the rare one: an UPGRADED card
    if (this.flipped >= this.slots.length) this.finish();
  }
  async flipAll() {
    if (this.phase !== 'cards') return;
    const todo = this.slots.map((_, i) => i).filter((i) => this.slots[i].dataset.flipped !== 'true');
    if (!todo.length) return;
    this.flipAllBtn.hidden = true;
    play('flip', 0.6);
    if (todo.some((i) => RANK[this.slots[i].dataset.rarity || 'common'] >= 3)) play('sting', 0.55, 0.3);
    for (const i of todo) { this.flip(i, true); if (!this.skipping) await wait(110 * this.T); }
  }
  /** An upgraded card turned up (Nov 5): the sting, a long sparkle burst, the whole screen flashes in the tier's colour and the hint names it. Transform and opacity only. */
  private upgradeMoment(s: El, tier: number, quiet: boolean) {
    if (!quiet) play('sting', 0.7, 0.05);
    this.hint.textContent = `UPGRADED CARD! A ${TIER_NAMES[tier]} ${s.dataset.name?.split(',')[0] || 'card'}!`;
    if (reduced()) return;
    setTimeout(() => this.burst(s, 10 + tier * 8), 200 * this.T);
    setTimeout(() => this.burst(s, 8 + tier * 6), 650 * this.T);
    const flash = h('div', { class: 'pko-flash pko-flash-upg', 'data-tier': String(tier), 'aria-hidden': 'true' });
    this.root.append(flash);
    flash.animate([{ opacity: 0 }, { opacity: tier >= 4 ? 0.55 : 0.32, offset: 0.25 }, { opacity: 0 }], { duration: 900 * this.T, easing: 'ease-out', fill: 'forwards' }).finished.then(() => flash.remove(), () => flash.remove());
    s.animate([{ transform: 'none' }, { transform: 'scale(1.12) rotate(-2deg)', offset: 0.3 }, { transform: 'scale(1.06) rotate(1.5deg)', offset: 0.6 }, { transform: 'none' }], { duration: 700 * this.T, easing: 'ease-out' });
  }
  /** A short burst of sparkles from a rare card (transform/opacity only). */
  private burst(s: El, n: number) {
    if (reduced()) return;
    for (let k = 0; k < n; k++) {
      const sp = h('span', { class: 'pko-spark', 'aria-hidden': 'true' });
      s.append(sp);
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.4, d = 50 + Math.random() * 50;
      sp.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${(Math.cos(a) * d).toFixed(0)}px),calc(-50% + ${(Math.sin(a) * d).toFixed(0)}px)) scale(1)`, opacity: 0 }], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' }).finished.then(() => sp.remove(), () => sp.remove());
    }
  }
  private finish() {
    this.setPhase('done');
    this.flipAllBtn.hidden = true;
    const best = Math.max(...this.slots.map((s) => RANK[s.dataset.rarity || 'common'] ?? 0));
    const news = this.cards.filter((c) => c.is_new).length;
    const bestTier = Math.max(...this.slots.map((s) => Number(s.dataset.tier) || 1));
    this.hint.textContent = bestTier > 1 ? `An UPGRADED ${TIER_NAMES[bestTier]} card dropped! Combine copies in your Collection to make your own.` : best >= 4 ? 'A COLLECTOR card! Frame it. Guard it. Name it something heroic.' : best >= 3 ? 'Ultra Rare! The goblins are jealous.' : news ? `${news} new card${news === 1 ? '' : 's'} for your collection!` : 'More friends for your decks!';
    this.againBtn.textContent = this.o.againLabel();
    this.againBtn.hidden = !this.o.canAgain();
    this.againBtn.disabled = false;
    this.doneBtn.hidden = false;
  }
  /** Jumps past the animation: to the face-down row, or (already there) every card face up. */
  skip() {
    if (this.phase === 'idle' || this.phase === 'ripping') {
      this.skipping = true;
      this.sealed.style.opacity = '0';
      for (const a of this.root.getAnimations({ subtree: true } as any)) { try { a.finish(); } catch { /* infinite */ } }
      this.shredBox.replaceChildren();
      this.wobble.classList.remove('pko-shaking');
      this.ripBtn.hidden = true;
      this.setPhase('cards');
      this.afterDeal();
      this.skipping = false;
      return;
    }
    if (this.phase === 'cards') { this.skipping = true; for (let i = 0; i < this.slots.length; i++) this.flip(i, true); this.skipping = false; }
  }
  close() { this.root.remove(); if (current === this) current = null; }
}

/** A turned card, big (tap or Escape to close): the row is small on a phone. */
function zoomCard(card: any) {
  const ov = h('div', { class: 'col-zoom', role: 'dialog', 'aria-modal': 'true', 'aria-label': card.name, tabindex: '-1' }, h('div', { class: 'col-big' }, ohCardEl(card, pictureOf(card))));
  const close = () => ov.remove();
  ov.addEventListener('click', close);
  ov.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') close(); });
  document.body.append(ov);
  ov.focus();
}
const backFace = () => ohCardEl({ id: 'back', type: 'back', faction: 'goblins', name: '', text: '' }, null);

/** Puts up the pack-opening scene for a finished `open_pack` result. */
export function showPackOpening(o: Opts) {
  current?.close();
  current = new Scene(o);
  if (isTestPage()) (window as any).__ohPack = { state: () => current?.state() ?? { phase: 'idle', flipped: 0, cards: [] }, flipAll: () => current?.flipAll(), skip: () => current?.skip(), rip: () => current?.rip() };
  return current;
}
