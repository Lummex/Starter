// The Dashboard's Exit button (Ken, Nov 7: "I would also like exit button on the dashboard"). A confirm box offers
// "Exit Oreheart" and "Sign out". Exit closes the installed app / PWA window; a normal browser tab can't close itself, so it
// shows a goodbye screen ("You can close this tab") with a way back. Sign out signs out and returns to the title (login) screen.
// A running online match is never left hanging: Exit or Sign out first gives it up through the existing forfeit (the box says so).
import { h } from '../ui/app';
import type { App } from '../ui/app';

type El = HTMLElement;

/** the installed app or a PWA window (those can close themselves); a normal tab can't */
export const isInstalledApp = () => {
  try { return matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as any).standalone === true; }
  catch { return false; }
};

async function leaveRunningMatch(): Promise<void> {
  try {
    const pvp = await import('./pvp');
    const id = pvp.currentActiveMatch();
    if (id) await pvp.transport().call('forfeit', { matchId: id }).catch(() => null);
  } catch { /* nothing running */ }
}

export async function openExit(app: App): Promise<void> {
  let running: string | null = null;
  try { running = (await import('./pvp')).currentActiveMatch(); } catch { /* none */ }
  const btn = (label: string, cls: string, testid: string, onclick: () => void) => h('button', { type: 'button', class: `btn panel ${cls}`, 'data-testid': testid, onclick }, label);
  const d: any = app.dialog('Leave Oreheart?', [
    h('h2', {}, 'Leave Oreheart?'),
    h('p', { style: 'text-align:center;margin:0' }, running ? 'You still have an online match running. Leaving now counts as giving it up.' : 'Your cards, decks and coins are saved on the server.'),
    h('div', { class: 'row exit-row' },
      btn('Exit Oreheart', 'play', 'exit-app', () => { d.close(); void exitApp(app, !!running); }),
      btn('Sign out', '', 'exit-signout', () => { d.close(); void (async () => { if (running) await leaveRunningMatch(); (await import('./flow')).signOut(); })(); }),
      btn('Stay', '', 'exit-stay', () => d.close()))]);
  d.el.setAttribute('data-testid', 'exit-dialog');
}

async function exitApp(app: App, running: boolean): Promise<void> {
  if (running) await leaveRunningMatch();
  if (isInstalledApp()) {
    try { window.close(); } catch { /* fall through */ }
    await new Promise((r) => setTimeout(r, 300)); // still here? (some browsers refuse) then the goodbye screen
  }
  goodbye(app);
}

/** the goodbye screen (a normal tab can't close itself): the title look, "You can close this tab", and a way back */
export function goodbye(app: App): void {
  app.clear();
  const back = h('button', { type: 'button', class: 'btn panel play', 'data-testid': 'goodbye-back', onclick: () => app.showMenu() }, 'Back to Oreheart');
  const el: El = h('main', { class: 'screen center goodbye', 'data-screen': 'goodbye', 'aria-label': 'Goodbye' },
    h('div', { class: 'logo', 'aria-hidden': 'true' }),
    h('h1', {}, 'See you on the battlefield!'),
    h('p', { 'data-testid': 'goodbye-note' }, 'You can close this tab now.'),
    h('div', { class: 'row' }, back));
  app.root.append(el);
  back.focus();
}
