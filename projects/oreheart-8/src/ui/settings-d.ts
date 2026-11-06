// Settings, design D (Ken, Nov 6: "the settings menu. To look like the modern menus."): the tabbed mockup (studio/screens-D-nov5/set3/
// settings): a rail with Sound, Display, Gameplay, Account and Language, every section a silver dark-glass panel of rows, Restore
// defaults and Save changes. On a PC every section is on screen (the rail jumps to one); on a phone the rail shows one at a time.
// Every control keeps the same saved setting it had (the same localStorage keys, the same audio calls), so nothing in the game
// changes behind it; the old builders in app.ts are reused where they already fit. Works offline (vs-computer has Settings too):
// then the top bar is just the logo and Back goes to the title menu. Where the mockup drew something that does not exist yet
// (account sync, password change, friend requests, other languages) the row says "coming soon" instead of pretending.
import '../net/dashboard.css'; // the D kit (offline too: the net modules that also load it are not on screen then)
import { h, btn, type App } from './app';
import { net } from '../net/state';
import { audio, DEFAULT_SFX_VOLUME } from './audio';
import { setHiddenStarters } from './decks';
import { resetHighlights, resetRings, applyHighlightVars } from './fx-settings';

type El = HTMLElement;
const ico = (src: string) => h('img', { src, alt: '', draggable: 'false' });
const SECTIONS: [string, string, string][] = [['sound', 'Sound', 'Volume and voices'], ['display', 'Display', 'Quality and screen'], ['gameplay', 'Gameplay', 'Timers and help'], ['account', 'Account', 'Email, password, privacy'], ['language', 'Language', 'English']];
let cur = 'sound';

/** one row: the label (and a small line under it) on the left, the control on the right */
const row = (label: string, sub: string | null, control: El | El[], testid?: string) =>
  h('div', { class: 'set', 'data-testid': testid || null }, h('span', { class: 'lbl' }, label, sub ? h('small', {}, sub) : null), h('div', { class: 'ctl' }, ...(Array.isArray(control) ? control : [control])));
/** a switch: a button with role=switch (keyboard and screen readers get a real switch, the checks see no native control) */
function tog(label: string, on: boolean, onChange: ((on: boolean) => void) | null, testid?: string): El {
  const b = h('button', { type: 'button', class: 'tog' + (on ? ' on' : '') + (onChange ? '' : ' soon'), role: 'switch', 'aria-checked': String(on), 'aria-label': label, 'data-testid': testid || null, disabled: onChange ? null : '' }, h('i', { 'aria-hidden': 'true' }));
  if (onChange) b.addEventListener('click', () => { const next = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(next)); b.classList.toggle('on', next); onChange(next); });
  return b;
}
/** a segmented choice: Low / High, Normal / Fast ... */
function seg(label: string, opts: [string, string][], curV: string, onChange: (v: string) => void, testid?: string): El {
  const g = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label, 'data-testid': testid || null });
  for (const [v, text] of opts) {
    const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === curV), 'data-v': v }, text);
    b.addEventListener('click', () => { for (const x of g.querySelectorAll('button')) x.setAttribute('aria-checked', String(x === b)); onChange(v); });
    g.append(b);
  }
  return g;
}
/** a volume slider with its percentage; the same ids the game had (sfx-vol, voice-vol, music-vol) */
function vol(label: string, id: string, value: number, on: (v: number) => void): El {
  const inp = h('input', { type: 'range', id, min: '0', max: '100', step: '1', value: String(value), 'aria-label': label }) as HTMLInputElement;
  const pct = h('b', { class: 'pct' }, `${value}%`);
  inp.addEventListener('input', () => { on(+inp.value); pct.textContent = `${inp.value}%`; });
  return h('div', { class: 'vol' }, inp, pct);
}
const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* fine */ } };

export function showSettingsD(app: App): void {
  app.clear();
  const online = net.active;
  const root = h('main', { class: 'screen dash settings-d' + (online ? '' : ' offline'), 'data-screen': 'settings', 'aria-label': 'Settings' });
  app.root.append(root);
  const top = h('div', { class: 'top', 'aria-hidden': 'true' });
  const back = btn(online ? '‹ Dashboard' : 'Back', 'panel back-btn', () => app.showMenu(), { 'data-testid': 'settings-back' });
  const head = h('div', { class: 'hdr' }, back, h('h1', { class: 'h ttl' }, 'Settings'), h('div', { class: 'info' }, 'Changes show right away'));

  // ---- the sections
  const sections: Record<string, El> = {};
  const sec = (id: string, title: string, extra: El | null, ...rows: (El | null)[]) => {
    const s = h('section', { class: 'panel sec', 'data-sec': id, 'aria-label': title }, h('div', { class: 'ptitle h' }, title, extra), ...rows.filter((r): r is El => !!r));
    sections[id] = s;
    return s;
  };
  // Sound
  const muteBtn = h('button', { type: 'button', class: 'more', 'data-testid': 'mute-all' }, audio.muted ? 'Unmute' : 'Mute all');
  muteBtn.addEventListener('click', () => { audio.setMuted(!audio.muted); muteBtn.textContent = audio.muted ? 'Unmute' : 'Mute all'; root.classList.toggle('muted', audio.muted); });
  root.classList.toggle('muted', audio.muted);
  const sound = sec('sound', 'Sound', muteBtn,
    row('Music', null, vol('Music volume', 'music-vol', audio.music, (v) => audio.setMusic(v))),
    row('Effects', 'Hits, spells, KA-BOOM!', vol('Sound effects volume', 'sfx-vol', audio.sfx, (v) => audio.setSfx(v))),
    row('Voices', 'Goblin grunts and gnome gibberish', vol('Voices volume', 'voice-vol', audio.voice, (v) => audio.setVoice(v))),
    row('Mute in the background', 'When you switch to another window · coming soon', tog('Mute in the background (coming soon)', false, null)));
  // Display
  const display = sec('display', 'Display', null,
    row('Quality', 'Models, shadows, effects', seg('Quality', [['low', 'Low'], ['high', 'High']], app.low ? 'low' : 'high', (v) => set('oreheart.graphics', v), 'set-quality')),
    row('Display mode', 'Auto fills the screen; PC locks 16:9; Phone locks the phone shape', app.displayModeGroup()),
    row('Full screen', null, app.screenButton()),
    row('Flow particles', 'The crystal sparkle on the board', app.flowGroup()));
  // Gameplay
  const starters = btn('Restore starter decks', 'sbtn panel', (e) => { setHiddenStarters([]); (e.currentTarget as El).textContent = 'Starter decks restored'; });
  const fx = h('div', { class: 'fx-wrap', hidden: true }, ...app.fxPanels());
  const fxBtn = btn('Open', 'sbtn panel', () => { fx.hidden = !fx.hidden; fxBtn.textContent = fx.hidden ? 'Open' : 'Close'; }, { 'aria-expanded': 'false', 'data-testid': 'fx-open' });
  fxBtn.addEventListener('click', () => fxBtn.setAttribute('aria-expanded', String(!fx.hidden)));
  const gameplay = sec('gameplay', 'Gameplay', null,
    row('Moves reminder', 'A nudge when a unit still has a move', tog('Moves reminder', app.remindMoves, (on) => set('oreheart.movesReminder', on ? 'on' : 'off'), 'set-remind')),
    row('Ask before using banked crystals', 'A question before a payment dips into the Bank', tog('Ask before using banked crystals', app.askBank, (on) => set('oreheart.askBank', on ? 'on' : 'off'), 'set-askbank')),
    row('Card reveals', 'How long a drawn card is shown', seg('Card reveals', [['normal', 'Normal'], ['fast', 'Fast']], ls('oreheart.reveal') === 'fast' ? 'fast' : 'normal', (v) => set('oreheart.reveal', v), 'set-reveal')),
    row('Card pop-ups', 'The big card when you hover or tap one', tog('Card pop-ups', app.popups, (on) => set('oreheart.popups', on ? 'on' : 'off'), 'set-popups')),
    row('Square highlights and unit rings', 'Colours, glow and thickness', fxBtn),
    fx,
    row('Tutorial', 'Learn the basics again', btn('Play the tutorial', 'sbtn panel', () => { set('oreheart.tutorialSeen', '1'); app.beginTutorial(); }, { 'data-testid': 'play-tutorial' })),
    row('Starter decks', 'Bring back any starter deck you removed', starters));
  // Account
  const emailEl = h('b', { 'data-testid': 'settings-email' }, online ? '…' : '—');
  const accountRows: (El | null)[] = online ? [
    row('Email', null, emailEl),
    row('Password', 'Change it · coming soon', btn('Change password', 'sbtn panel', undefined, { disabled: '' })),
    row('Show me on the rankings', 'Your name and rank on the leaderboard · always on for now', tog('Show me on the rankings (coming soon)', true, null)),
    row('Allow friend requests', 'coming soon', tog('Allow friend requests (coming soon)', false, null)),
    h('div', { class: 'links', 'data-testid': 'settings-links' }),
  ] : [row('Account', 'Sign in from the title menu to see your email, documents and sign-out here', h('span', { class: 'muted' }, 'Playing offline'))];
  const account = sec('account', 'Account', null, ...accountRows, app.offlinePanel());
  if (online) {
    void import('../net/online').then((m) => m.client().auth.getUser()).then(({ data }) => { const em = data.user?.email || ''; emailEl.textContent = em ? em.replace(/^(.{2})[^@]*(@.*)$/, '$1…$2') : '—'; }).catch(() => { emailEl.textContent = '—'; });
    void import('../net/flow').then((m) => {
      const links = account.querySelector('[data-testid="settings-links"]') as El | null;
      if (!links) return;
      const again = () => showSettingsD(app);
      links.append(...m.docButtons(again).map((b) => { b.classList.add('lnk'); return b; }), h('button', { type: 'button', class: 'net-btn lnk', onclick: () => m.showContact({ back: again }) }, 'Contact us'),
        h('button', { type: 'button', class: 'net-btn lnk signout', 'data-testid': 'settings-signout', onclick: () => { void m.signOut(); } }, 'Sign out'));
    }).catch(() => {});
  }
  // Language
  const language = sec('language', 'Language', null,
    row('Game language', 'Menus, cards and tips', h('div', { class: 'chips' }, h('span', { class: 'ch on' }, 'English'))),
    row('Coming soon', null, h('div', { class: 'chips soon' }, ...['Español', 'Deutsch', 'Français', 'Português'].map((l) => h('span', { class: 'ch' }, l)))));

  // ---- the rail
  const railBtns: El[] = [];
  const pick = (id: string) => {
    cur = id;
    for (const b of railBtns) b.setAttribute('aria-current', String(b.dataset.sec === id));
    for (const [k, s] of Object.entries(sections)) s.toggleAttribute('data-cur', k === id);
    if (matchMedia('(min-width: 901px)').matches) sections[id]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  for (const [id, title, sub] of SECTIONS) {
    const b = h('button', { type: 'button', class: 'rt', 'data-sec': id, 'data-testid': 'tab-' + id, onclick: () => pick(id) }, h('b', { class: 'h' }, title), h('span', {}, sub));
    railBtns.push(b);
  }
  const restore = btn('Restore defaults', 'sbtn panel', () => {
    for (const k of ['oreheart.graphics', 'oreheart.display', 'oreheart.flow', 'oreheart.popups', 'oreheart.reveal', 'oreheart.movesReminder', 'oreheart.askBank']) { try { localStorage.removeItem(k); } catch { /* fine */ } }
    audio.setSfx(DEFAULT_SFX_VOLUME); audio.setVoice(80); audio.setMusic(60); audio.setMuted(false);
    resetHighlights(); resetRings(); applyHighlightVars();
    (app.constructor as any).applyDisplay?.();
    showSettingsD(app);
  }, { 'data-testid': 'restore-defaults' });
  const save = btn('Save changes', 'panel play', () => { void import('../net/economy').then((m) => m.toast('Saved on this device', '/art/ui/silver/icon-settings.webp')).catch(() => {}); app.showMenu(); }, { 'data-testid': 'save-settings' });
  save.prepend(ico('/art/ui/silver/icon-settings.webp'));
  const rail = h('div', { class: 'panel rail' }, ...railBtns, h('div', { class: 'sep' }), h('div', { class: 'grow' }), restore, save, h('p', { class: 'note' }, 'Changes save right away on this device. Account sync: coming soon.'));

  root.append(top, h('div', { class: 'logo', 'aria-hidden': 'true' }), head,
    h('div', { class: 'main' }, rail, h('div', { class: 'cols' }, h('div', { class: 'col' }, sound, gameplay), h('div', { class: 'col' }, display, account, language))));
  pick(cur);
  // the top bar fills itself from the Dashboard's data when signed in (coins, packs, avatar); offline it is just the logo
  if (online) void import('../net/dashboard').then((m) => m.loadAll().then((d) => { if (top.isConnected) { const t = m.topBar(d); t.setAttribute('aria-hidden', 'true'); top.replaceWith(t); } })).catch(() => {});
}
