// Sound effects and Goblin voices. Nothing is created until the first user gesture.
// Oct 31 (Ken: "upgrade the sound"): effects play Brush's files in /audio/sfx/ (studio/sound-spec.json); the old synthesized
// sound plays until a file has loaded (or if it fails to decode). Voices (voiceLine) stay synthesized.
// Oct 31 (Ken: "realistic punches"): every bonk / clink / Commander hit also plays a punch layer (punch-*.ogg, PUNCH_FOR).
const LS = (k: string, d: number) => { const v = parseInt(localStorage.getItem(k) || '', 10); return isNaN(v) ? d : Math.max(0, Math.min(100, v)); };

/** One sound event: its files in /audio/sfx/ (random pick when several), base volume, random pitch range (+/- semitones). */
type SfxDef = { files: string[]; vol: number; st: number };
const D = (files: string | string[], vol: number, st: number): SfxDef => ({ files: Array.isArray(files) ? files : [files], vol, st });
export const sfxUrl = (file: string) => `/audio/sfx/${file}.ogg`;
/** Event -> files, from studio/sound-spec.json (Brush, Oct 31). Keys are the audio.play() names; footsteps are step:<faction>, spells spell:<id>. */
export const SFX: Record<string, SfxDef> = {
  click: D('ui-click', 0.7, 0.5), tick: D('ui-tick', 0.6, 0.3), chime: D('ui-chime', 0.7, 0), draw: D('card-draw', 0.7, 1), cardPlay: D('card-play', 0.8, 0.7),
  summon: D('summon', 0.85, 0.5), 'step:goblins': D('step-goblin', 0.5, 1.5), 'step:gnomes': D('step-gnome', 0.5, 1.5), 'step:dwarves': D('step-dwarf', 0.55, 1.2),
  melee: D('melee', 0.9, 1), ranged: D('ranged', 0.85, 1), bonk: D(['bonk-1', 'bonk-2', 'bonk-3'], 0.9, 1), clink: D(['clink-1', 'clink-2', 'clink-3'], 0.85, 0.8),
  thud: D('thud', 0.85, 1), pick: D('mine-pick', 0.8, 1), shatter: D('shatter', 0.85, 0.5), 'defeat-poof': D('defeat-poof', 0.85, 0.8),
  stronghold: D('commander-hit', 1, 0.5), kaboom: D('kaboom', 1, 0.5), 'turn-start': D('turn-start', 0.85 * 0.6, 0), win: D('win', 1, 0), lose: D('lose', 1, 0),
  // Oct 31 (Ken: "realistic punches"): layered under the hit sounds inside play() (studio/voice-spec.json "punches")
  punch: D(['punch-1', 'punch-2', 'punch-3'], 0.8, 1), 'punch-armour': D(['punch-armour-1', 'punch-armour-2'], 0.8, 1), 'punch-heavy': D('punch-heavy', 0.9, 1),
  // Oct 31 (Brush, studio/sound-spec.json): each projectile's own firing sound at its release and impact sound on landing
  'shot-rifle': D('shot-rifle', 0.9, 0.8), 'shot-cannon': D('shot-cannon', 1, 0.5), 'throw-whoosh': D('throw-whoosh', 0.8, 1.5), 'cast-zap': D('cast-zap', 0.85, 1),
  'cast-hex': D('cast-hex', 0.8, 1), 'fireball-whoosh': D('fireball-whoosh', 0.85, 1), 'bowl-roll': D('bowl-roll', 0.6, 0), 'skull-crack': D('skull-crack', 0.9, 1),
  'book-thud': D('book-thud', 0.9, 1), 'zap-hit': D('zap-hit', 0.9, 1), 'fire-burst': D('fire-burst', 0.9, 0.8), 'pins-scatter': D('pins-scatter', 0.95, 0.8),
};
/** Which firing (at the release) and impact (on landing) sound each shooter's projectile plays; the hit's bonk/clink and punch still play under it. */
export const SHOT_SOUNDS: Record<string, { fire: string; hit?: string }> = {
  'oathbound-pikeman': { fire: 'shot-rifle' }, 'deepforge-crossbowman': { fire: 'shot-cannon' },
  'goblin-slinger': { fire: 'throw-whoosh', hit: 'skull-crack' }, 'axe-thrower': { fire: 'throw-whoosh', hit: 'book-thud' },
  'spark-gnome': { fire: 'cast-zap', hit: 'zap-hit' }, 'hexwright-apprentice': { fire: 'cast-hex', hit: 'zap-hit' }, 'gyrocopter-ace': { fire: 'fireball-whoosh', hit: 'fire-burst' },
};
/** Which punch layer goes under which hit sound: bonk = unarmoured hit, clink = armoured hit, stronghold = a Commander hit. */
export const PUNCH_FOR: Record<string, string> = { bonk: 'punch', clink: 'punch-armour', stronghold: 'punch-heavy' };
/** All 13 spells have their own file, started together with the spell FX. */
export const SPELL_SOUNDS = ['fireball', 'meteor-strike', 'venom-shiv', 'tunnel-rush', 'battle-cry', 'healing-light', 'shield-bubble', 'second-wind', 'prospectors-prayer', 'fizzle', 'hold-it', 'spell-snap', 'mirror-hex'];
for (const id of SPELL_SOUNDS) SFX['spell:' + id] = D('spell-' + id, 1, 0);
const OLD_SPELL: Record<string, string> = { fireball: 'fireball', 'meteor-strike': 'meteor', 'healing-light': 'heal', 'second-wind': 'heal', 'shield-bubble': 'bubble' };
const MAX_VOICES = 3;
/** Test hook entry: which key/file played, from the file or the synth fallback, its playbackRate and volume. */
export type SfxPlay = { key: string; file: string | null; from: 'file' | 'synth' | 'muted' | 'locked'; rate: number; vol: number; voices: number; t: number; played: boolean; punch?: { key: string; file: string | null; from: string; rate: number } | null };

class AudioEngine {
  ctx: AudioContext | null = null;
  unlocked = false;
  sfx = LS('oreheart.sfxVolume', 80);
  voice = LS('oreheart.voiceVolume', 80);
  muted = localStorage.getItem('oreheart.muted') === '1';
  private sfxGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor() {
    const unlock = () => {
      if (this.unlocked) return;
      this.unlocked = true;
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
        this.sfxGain = this.ctx.createGain();
        this.voiceGain = this.ctx.createGain();
        this.sfxGain.connect(this.ctx.destination);
        this.voiceGain.connect(this.ctx.destination);
        this.applyVolumes();
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = b;
        void this.ctx.resume();
      } catch { this.ctx = null; }
      this.musicTick();
      setTimeout(() => this.loadSfx(), 300); // lazy: the sound files load after the first gesture, never slowing the menu
      for (const e of ['pointerdown', 'keydown', 'click', 'touchstart']) window.removeEventListener(e, unlock, true);
    };
    for (const e of ['pointerdown', 'keydown', 'click', 'touchstart']) window.addEventListener(e, unlock, true);
  }

  music = LS('oreheart.musicVolume', 60);
  musicMode: 'menu' | 'match' = 'menu';
  musicOn = localStorage.getItem('oreheart.musicOff') !== '1';
  private tracks: Record<string, HTMLAudioElement> = {};
  private fadeT: any = null;
  private starts: Record<string, number> = {};
  private trackEl(k: 'menu' | 'match') {
    if (!this.tracks[k]) {
      const a = new Audio(k === 'menu' ? '/audio/music/tense-cycle.mp3' : '/audio/music/first-fight.mp3');
      a.loop = true; a.preload = 'auto'; a.volume = 0;
      this.tracks[k] = a;
      a.addEventListener('play', () => { this.starts[k] = (this.starts[k] || 0) + 1; });
    }
    return this.tracks[k];
  }
  /** Target volume of a track (0..1) after music volume, mute and the on/off switch. */
  private musicTarget(k: 'menu' | 'match') { return this.muted || !this.musicOn || !this.unlocked || k !== this.musicMode ? 0 : (this.music / 100) * 0.5; }
  musicState() {
    const v = (k: 'menu' | 'match') => { const a = this.tracks[k]; return a ? { playing: !a.paused, volume: a.volume } : { playing: false, volume: 0 }; };
    const cur = this.tracks[this.musicMode];
    return { mode: this.musicMode, on: this.musicOn, volume: this.music, menu: v('menu'), match: v('match'), muted: this.muted,
      track: this.unlocked ? this.trackName(this.musicMode) : null, playing: !!cur && !cur.paused, gain: this.muted || !this.musicOn ? 0 : (this.music / 100) * 0.5, crossfadeMs: 1500, startCount: this.starts[this.musicMode] || 0 };
  }
  musicLog: { track: string; fadeMs: number }[] = [];
  private trackName(m: 'menu' | 'match') { return m === 'match' ? 'first-fight' : 'tense-cycle'; }
  setMusicMode(m: 'menu' | 'match') { if (m !== this.musicMode || !this.musicLog.length) this.musicLog.push({ track: this.trackName(m), fadeMs: 1500 }); this.musicMode = m; this.musicTick(); }
  setMusic(v: number) { this.music = v; localStorage.setItem('oreheart.musicVolume', String(v)); this.musicTick(); }
  setMusicOn(on: boolean) { this.musicOn = on; localStorage.setItem('oreheart.musicOff', on ? '0' : '1'); this.musicTick(); }
  /** Crossfades (about 1.5 s) towards the track for the current mode. */
  musicTick() {
    clearInterval(this.fadeT);
    if (!this.unlocked) return;
    for (const k of ['menu', 'match'] as const) { if (this.musicTarget(k) > 0) { const a = this.trackEl(k); if (a.paused) void a.play().catch(() => {}); } }
    const step = () => {
      let busy = false;
      for (const k of ['menu', 'match'] as const) {
        const a = this.tracks[k]; if (!a) continue;
        const t = this.musicTarget(k), d = t - a.volume;
        if (Math.abs(d) < 0.01) { a.volume = t; if (t === 0 && !a.paused) a.pause(); } else { a.volume = Math.max(0, Math.min(1, a.volume + Math.sign(d) * Math.max(0.0125, Math.abs(d) * 0.08))); busy = true; }
      }
      if (!busy) clearInterval(this.fadeT);
    };
    this.fadeT = setInterval(step, 50); step();
  }

  sfxLog: { name: string; src: string; screen: string; t: number; played: boolean }[] = [];
  state() { return { sfxLog: this.sfxLog.slice(), sfx: this.sfxState(), unlocked: this.unlocked, muted: this.muted, sfxVolume: this.sfx, musicVolume: this.music, voiceVolume: this.voice, music: this.musicState(), log: this.musicLog.slice() }; }
  applyVolumes() {
    if (!this.sfxGain || !this.voiceGain) return;
    this.sfxGain.gain.value = this.muted ? 0 : (this.sfx / 100) * 0.7;
    this.voiceGain.gain.value = this.muted ? 0 : (this.voice / 100) * 0.7;
  }
  setSfx(v: number) { this.sfx = v; localStorage.setItem('oreheart.sfxVolume', String(v)); this.applyVolumes(); }
  setVoice(v: number) { this.voice = v; localStorage.setItem('oreheart.voiceVolume', String(v)); this.applyVolumes(); }
  setMuted(m: boolean) { this.muted = m; localStorage.setItem('oreheart.muted', m ? '1' : '0'); this.applyVolumes(); this.musicTick(); }

  private ok() { return !!(this.ctx && this.sfxGain && !this.muted); }
  private tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, delay = 0, voice = false) {
    if (!this.ok()) return;
    const c = this.ctx!, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(voice ? this.voiceGain! : this.sfxGain!);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, freq: number, q = 1, vol = 0.5, delay = 0, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
    if (!this.ok() || !this.noiseBuf) return;
    const c = this.ctx!, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.sfxGain!);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // ------------------------------------------------------------ sound files (Oct 31)
  private bufs = new Map<string, AudioBuffer>();
  private fileState: Record<string, 'loading' | 'ok' | 'error'> = {};
  private voices: Record<string, { src: AudioBufferSourceNode; t: number }[]> = {};
  private lastVariant: Record<string, number> = {};
  private sfxLoading = false;
  sfxPlays: SfxPlay[] = [];
  /** Fetches and decodes every sound file once and caches the buffers. */
  loadSfx() {
    if (this.sfxLoading || !this.ctx) return;
    this.sfxLoading = true;
    const c = this.ctx;
    for (const n of [...new Set(Object.values(SFX).flatMap((d) => d.files))]) {
      this.fileState[n] = 'loading';
      fetch(sfxUrl(n)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
        .then((ab) => new Promise<AudioBuffer>((res, rej) => c.decodeAudioData(ab, res, rej)))
        .then((b) => { this.bufs.set(n, b); this.fileState[n] = 'ok'; })
        .catch(() => { this.fileState[n] = 'error'; });
    }
  }
  sfxState() {
    const active: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.voices)) if (v.length) active[k] = v.length;
    return { plays: this.sfxPlays.slice(), files: { ...this.fileState }, loaded: [...this.bufs.keys()].filter((n) => !n.startsWith('punch')).length, punchLoaded: [...this.bufs.keys()].filter((n) => n.startsWith('punch')).length, map: Object.fromEntries(Object.entries(SFX).map(([k, d]) => [k, d.files.map(sfxUrl)])),
      gain: this.sfxGain ? this.sfxGain.gain.value : null, maxVoices: MAX_VOICES, active };
  }
  /** Plays a named effect: its sound file when loaded, otherwise the old synthesized sound. Unknown names are ignored. */
  play(name: string, faction = 'goblins') {
    const e = this.playKey(name === 'step' ? 'step:' + faction : name, () => this.synth(name, faction));
    if (PUNCH_FOR[name] && e.played) e.punch = this.punch(PUNCH_FOR[name]);
  }
  private heavyAt = -1e9;
  /** The punch layer under a hit. A Commander hit gets only the heavy punch: its board bonk and its stronghold sound land within a few ms of each other. */
  private punch(key: string) {
    const now = performance.now();
    if (key === 'punch' && now - this.heavyAt < 250) return null;
    if (key === 'punch-heavy') {
      this.heavyAt = now;
      const c = this.ctx, vs = this.voices.punch || [];
      if (c) for (const v of vs.slice()) if (c.currentTime - v.t < 0.25) { try { v.src.stop(); } catch { /* ended */ } }
    }
    const p = this.playKey(key, () => { /* no synth punch: the hit's own sound carries it until the file loads */ }, true);
    return { key, file: p.file, from: p.from === 'synth' ? 'none' : p.from, rate: p.rate }; // logged on the hit's own entry (sfxState().plays[i].punch)
  }
  /** A spell's own sound (spell-<id>.ogg), started at the same moment as its FX; a generic sound for unknown spells. */
  spell(id: string) {
    const key = 'spell:' + id;
    this.playKey(SFX[key] ? key : 'spell', () => this.synth(OLD_SPELL[id] || 'spell'));
  }
  private playKey(key: string, fallback: () => void, quiet = false): SfxPlay {
    const def = SFX[key];
    const e: SfxPlay = { key, file: null, from: 'synth', rate: 1, vol: 0, voices: 0, t: Math.round(performance.now()), played: false };
    const log = () => { if (quiet) return; this.sfxPlays.push(e); if (this.sfxPlays.length > 300) this.sfxPlays.shift(); };
    if (!this.ok()) { e.from = this.muted ? 'muted' : 'locked'; log(); return e; }
    let file: string | null = null;
    if (def) {
      let i = 0;
      if (def.files.length > 1) { // random variant, never the same one twice in a row
        const last = this.lastVariant[key];
        i = Math.floor(Math.random() * (def.files.length - (last === undefined ? 0 : 1)));
        if (last !== undefined && i >= last) i++;
        this.lastVariant[key] = i;
      }
      file = def.files[i];
      e.file = sfxUrl(file);
    }
    const buf = file ? this.bufs.get(file) : undefined;
    if (!def || !buf) { fallback(); e.played = true; log(); return e; }
    const c = this.ctx!;
    const rate = Math.pow(2, ((Math.random() * 2 - 1) * def.st) / 12), vol = def.vol * Math.pow(10, ((Math.random() * 2 - 1) * 1.5) / 20);
    const vs = (this.voices[key] ||= []);
    while (vs.length >= MAX_VOICES) { const old = vs.shift()!; try { old.src.stop(); } catch { /* already ended */ } } // steal the oldest
    const src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol; (src as any).__g = g;
    src.connect(g).connect(this.sfxGain!); // through sfxGain: the volume slider and mute still apply
    const v = { src, t: c.currentTime };
    vs.push(v);
    src.onended = () => { const k = vs.indexOf(v); if (k >= 0) vs.splice(k, 1); try { g.disconnect(); } catch { /* gone */ } };
    src.start();
    Object.assign(e, { from: 'file', rate, vol, voices: vs.length, played: true });
    log();
    return e;
  }

  /** A looping effect (the Bowler's rolling ball): starts now, stop(ms) fades it out. Logged like any play (loop: true, stoppedAt). */
  loop(key: string): { stop(fadeMs?: number): void } {
    const e: any = this.playKey(key, () => { /* no synth loop */ });
    const vs = this.voices[key] || [], v = e.from === 'file' ? vs[vs.length - 1] : null;
    e.loop = true;
    if (v) v.src.loop = true;
    let done = false;
    return { stop: (fadeMs = 150) => {
      if (done) return; done = true; e.stoppedAt = Math.round(performance.now());
      if (!v || !this.ctx) return;
      const g = (v.src as any).__g as GainNode | undefined, t = this.ctx.currentTime;
      if (g) { g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + fadeMs / 1000); }
      try { v.src.stop(t + fadeMs / 1000 + 0.02); } catch { /* ended */ }
    } };
  }

  /** The old synthesized effects: the fallback until a file has loaded. */
  private synth(name: string, faction = 'goblins') {
    if (!this.ok()) return;
    switch (name) {
      case 'click': this.tone(520, 380, 0.07, 'square', 0.15); break;
      case 'draw': this.noise(0.12, 3000, 1, 0.25, 0, 'highpass'); this.tone(300, 500, 0.08, 'triangle', 0.15); break;
      case 'cardPlay': this.noise(0.1, 1200, 1, 0.3); this.tone(200, 120, 0.12, 'triangle', 0.3); break;
      case 'summon': this.noise(0.4, 400, 2, 0.4, 0, 'bandpass', 2500); this.tone(120, 60, 0.25, 'sine', 0.4, 0.3); break;
      case 'step': { const f = faction === 'goblins' ? 260 : faction === 'gnomes' ? 700 : 150; this.tone(f, f * 0.5, 0.06, faction === 'gnomes' ? 'square' : 'triangle', 0.15); if (faction === 'gnomes') this.tone(f * 1.5, f, 0.04, 'square', 0.08, 0.05); break; }
      case 'melee': this.noise(0.15, 900, 1, 0.6); this.tone(140, 50, 0.18, 'sawtooth', 0.4); break;
      case 'ranged': this.noise(0.18, 2500, 2, 0.35, 0, 'bandpass', 600); this.tone(900, 200, 0.15, 'triangle', 0.2); break;
      case 'bonk': this.tone(620, 160, 0.14, 'square', 0.28); this.noise(0.08, 700, 1, 0.35); this.tone(1240, 900, 0.05, 'sine', 0.12, 0.02); break; // Oct 30: cartoon bonk
      case 'clink': this.tone(2350, 2300, 0.18, 'sine', 0.22); this.tone(3520, 3400, 0.12, 'sine', 0.14, 0.01); this.noise(0.05, 6000, 3, 0.25, 0, 'highpass'); break; // metal clink
      case 'thud': this.noise(0.14, 300, 1, 0.45, 0, 'lowpass', 120); this.tone(110, 55, 0.12, 'sine', 0.35); break; // landing after a knock-back
      case 'pick': this.tone(1800, 1200, 0.06, 'square', 0.25); this.noise(0.06, 5000, 3, 0.3, 0, 'highpass'); break;
      case 'chime': this.tone(1320, 1320, 0.35, 'sine', 0.25); this.tone(1760, 1760, 0.4, 'sine', 0.2, 0.08); break;
      case 'tick': this.tone(900, 800, 0.05, 'square', 0.12); break;
      case 'spell': this.tone(300, 1200, 0.35, 'sawtooth', 0.2); this.noise(0.4, 1500, 2, 0.3, 0, 'bandpass', 4000); break;
      case 'fireball': this.noise(0.5, 600, 1, 0.5, 0, 'lowpass', 150); this.tone(200, 50, 0.45, 'sawtooth', 0.35); break;
      case 'meteor': this.noise(0.9, 300, 1, 0.7, 0.1, 'lowpass', 60); this.tone(90, 30, 0.8, 'sine', 0.6, 0.15); break;
      case 'heal': this.tone(523, 523, 0.3, 'sine', 0.25); this.tone(659, 659, 0.3, 'sine', 0.25, 0.1); this.tone(784, 784, 0.4, 'sine', 0.25, 0.2); break;
      case 'bubble': this.tone(300, 900, 0.2, 'sine', 0.3); this.tone(900, 1200, 0.1, 'sine', 0.15, 0.2); break;
      case 'shatter': this.noise(0.4, 6000, 1, 0.5, 0, 'highpass'); this.tone(2400, 600, 0.2, 'triangle', 0.2); break;
      case 'stronghold': this.noise(0.5, 250, 1, 0.8, 0, 'lowpass', 80); this.tone(80, 35, 0.5, 'sine', 0.7); break;
      case 'kaboom': this.noise(1.2, 500, 0.7, 0.9, 0, 'lowpass', 50); this.tone(70, 25, 1.0, 'sine', 0.9); this.tone(220, 40, 0.5, 'sawtooth', 0.3); break;
      case 'defeat-poof': this.tone(500, 200, 0.2, 'triangle', 0.3); this.noise(0.2, 2000, 1, 0.25); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.3, 'triangle', 0.3, i * 0.14)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, f * 0.98, 0.35, 'sawtooth', 0.2, i * 0.2)); break;
      case 'bonk': this.tone(700, 180, 0.18, 'sine', 0.45); this.noise(0.06, 1500, 2, 0.3); break;
      case 'clink': this.tone(2200, 2000, 0.25, 'triangle', 0.2); this.noise(0.05, 6000, 2, 0.25, 0, 'highpass'); break;
      case 'thud': this.noise(0.25, 300, 1, 0.6, 0, 'lowpass', 80); this.tone(90, 40, 0.2, 'sine', 0.5); break;
      case 'turn-start': this.tone(220, 220, 0.6, 'sawtooth', 0.12); this.tone(330, 330, 0.5, 'sawtooth', 0.08, 0.15); break;
      default: break;
    }
  }

  /** Gibberish grunts and cackles. */
  voiceLine(kind: 'grunt' | 'cackle' | 'stomp' | 'laugh' | 'sulk' | 'yell') {
    if (!this.ok() || !this.voiceGain) return;
    const n = kind === 'cackle' || kind === 'laugh' ? 6 : kind === 'yell' ? 3 : 2;
    const base = kind === 'laugh' ? 140 : kind === 'sulk' ? 110 : 190;
    for (let i = 0; i < n; i++) {
      const f = base * (1 + Math.random() * 0.5) * (kind === 'cackle' ? 1.6 : 1);
      this.tone(f, f * (kind === 'sulk' ? 0.6 : 1.4), 0.09, 'sawtooth', 0.28, i * 0.11, true);
    }
  }
}

export const audio = new AudioEngine();
