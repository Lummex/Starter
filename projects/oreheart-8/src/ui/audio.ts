// Sound effects and Goblin voices, synthesized with Web Audio (no files). Nothing is created until the first user gesture.
const LS = (k: string, d: number) => { const v = parseInt(localStorage.getItem(k) || '', 10); return isNaN(v) ? d : Math.max(0, Math.min(100, v)); };

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
      for (const e of ['pointerdown', 'keydown', 'click', 'touchstart']) window.removeEventListener(e, unlock, true);
    };
    for (const e of ['pointerdown', 'keydown', 'click', 'touchstart']) window.addEventListener(e, unlock, true);
  }

  music = LS('oreheart.musicVolume', 60);
  musicMode: 'menu' | 'match' = 'menu';
  musicOn = localStorage.getItem('oreheart.musicOff') !== '1';
  private tracks: Record<string, HTMLAudioElement> = {};
  private fadeT: any = null;
  private trackEl(k: 'menu' | 'match') {
    if (!this.tracks[k]) {
      const a = new Audio(k === 'menu' ? '/audio/music/tense-cycle.mp3' : '/audio/music/first-fight.mp3');
      a.loop = true; a.preload = 'auto'; a.volume = 0;
      this.tracks[k] = a;
    }
    return this.tracks[k];
  }
  /** Target volume of a track (0..1) after music volume, mute and the on/off switch. */
  private musicTarget(k: 'menu' | 'match') { return this.muted || !this.musicOn || !this.unlocked || k !== this.musicMode ? 0 : (this.music / 100) * 0.5; }
  musicState() {
    const v = (k: 'menu' | 'match') => { const a = this.tracks[k]; return a ? { playing: !a.paused, volume: a.volume } : { playing: false, volume: 0 }; };
    const cur = this.tracks[this.musicMode];
    return { mode: this.musicMode, on: this.musicOn, volume: this.music, menu: v('menu'), match: v('match'), muted: this.muted,
      track: this.unlocked ? this.trackName(this.musicMode) : null, playing: !!cur && !cur.paused, gain: this.muted || !this.musicOn ? 0 : (this.music / 100) * 0.5, crossfadeMs: 1500 };
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

  sfxLog: { src: string; screen: string; t: number }[] = [];
  state() { return { sfxLog: this.sfxLog.slice(), unlocked: this.unlocked, muted: this.muted, sfxVolume: this.sfx, musicVolume: this.music, voiceVolume: this.voice, music: this.musicState(), log: this.musicLog.slice() }; }
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

  /** Plays a named effect. Unknown names are ignored. */
  play(name: string, faction = 'goblins') {
    if (!this.ok()) return;
    switch (name) {
      case 'click': this.tone(520, 380, 0.07, 'square', 0.15); break;
      case 'draw': this.noise(0.12, 3000, 1, 0.25, 0, 'highpass'); this.tone(300, 500, 0.08, 'triangle', 0.15); break;
      case 'cardPlay': this.noise(0.1, 1200, 1, 0.3); this.tone(200, 120, 0.12, 'triangle', 0.3); break;
      case 'summon': this.noise(0.4, 400, 2, 0.4, 0, 'bandpass', 2500); this.tone(120, 60, 0.25, 'sine', 0.4, 0.3); break;
      case 'step': { const f = faction === 'goblins' ? 260 : faction === 'gnomes' ? 700 : 150; this.tone(f, f * 0.5, 0.06, faction === 'gnomes' ? 'square' : 'triangle', 0.15); if (faction === 'gnomes') this.tone(f * 1.5, f, 0.04, 'square', 0.08, 0.05); break; }
      case 'melee': this.noise(0.15, 900, 1, 0.6); this.tone(140, 50, 0.18, 'sawtooth', 0.4); break;
      case 'ranged': this.noise(0.18, 2500, 2, 0.35, 0, 'bandpass', 600); this.tone(900, 200, 0.15, 'triangle', 0.2); break;
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
