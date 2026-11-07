// The Main Dashboard, design D (Brush, Nov 5; Ken approved: "That is what I want"), the signed-in main menu on pvp-nov2.
// Rank and quests on the left, Play and the picture tiles in the middle, What's New (patch notes, events, news) and the
// upcoming events on the right; on a phone Play, six small tiles and one tabbed side panel. Real data where it exists
// (rank, quests, coins, My Packs, decks, collection, the news table); placeholders say "coming soon" instead of fake numbers.
// Offline / vs-computer keeps the older menu (ui/menus.ts).
import './dashboard.css';
import { h, type App } from '../ui/app';
import { net } from './state';
import { api, refreshCoins, lastShop, setShop, openScreen, isTestPage, type ShopInfo, type QuestsInfo, type RankCard, type NewsFeed, type NewsPost } from './economy';
import { showDecks } from '../ui/decks';
import { avatarPicture, avatarName } from './avatars';
import { getPlayerName } from '../ui/players';
import { ladderCharm, rankOfRating } from '../content/ladder';
import { collectionCards } from './quest-summary';
import { CARDS, COMMANDERS } from '../engine';
import { loadRegions, serverPillText, startHeartbeat, type RegionsInfo } from './regions';

type El = HTMLElement;
const ico = (src: string, cls = '') => h('img', { src, alt: '', draggable: 'false', class: cls || null });
const COIN = '/art/packs/icons/coin.webp', FREEPACK = '/art/packs/icons/free-pack.webp', QUEST = '/art/packs/icons/quest.webp';
const fmt = (n: number) => Number(n || 0).toLocaleString('en-US');
let app: App | null = null;
let dashMode = ((): string => { try { return localStorage.getItem('oreheart.playMode') || 'ranked'; } catch { return 'ranked'; } })();
const MODES: [string, string][] = [['ranked', 'Ranked'], ['unranked', 'Unranked'], ['friend', 'Friend'], ['computer', 'Computer']];

export interface Data { shop: ShopInfo | null; quests: QuestsInfo | null; rank: RankCard | null; news: NewsFeed | null; owned: Record<string, number> | null; online: boolean; regions?: RegionsInfo | null }
export async function loadAll(): Promise<Data> {
  const [shop, quests, rank, news, owned, regions] = await Promise.allSettled([api.shopInfo(), api.myQuests(), api.myRank(), api.newsFeed(), api.myCollection(), loadRegions()]);
  const v = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);
  const s = v(shop); if (s) setShop(s);
  return { shop: s, quests: v(quests), rank: v(rank), news: v(news), owned: v(owned), online: rank.status === 'fulfilled', regions: v(regions) };
}

/** "12d 06h" until the season ends */
function untilWords(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!isFinite(ms) || ms <= 0) return 'now';
  const d = Math.floor(ms / 86400000), hh = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${String(hh).padStart(2, '0')}h` : `${hh}h`;
}
const dayWords = (iso: string | null | undefined) => { if (!iso) return ['', '']; const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00Z' : '')); return [String(d.getUTCDate()), d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()]; };

export async function showDashboard(a: App): Promise<void> {
  app = a;
  a.clear();
  const root = h('main', { class: 'screen menu-screen dash', 'data-screen': 'title', 'data-dash': '1', 'aria-label': 'Main menu' });
  a.root.append(root);
  root.append(h('h1', { class: 'sr-only' }, 'Oreheart'));
  const data = await loadAll();
  // Nov 6 (regions): the heartbeat keeps this player counted as online and the server pill's count fresh while the dashboard is up
  startHeartbeat(root, () => { const pill = root.querySelector('[data-testid="dash-server"]'); if (pill) pill.replaceChildren(h('span', { class: 'dot' + (data.online ? '' : ' off') }), serverPillText(data.online)); });
  if (!root.isConnected) return;
  build(root, data);
  if (isTestPage()) (window as any).__dash = { data: () => data, mode: () => dashMode };
}

export function topBar(data: Data, extra: El[] = []): El {
  const name = getPlayerName();
  const avatarId = (data.rank && (data.rank as any).avatar) || net.avatar || null;
  const rk = data.rank ? data.rank.rank : null;
  const coins = data.shop ? data.shop.coins : null;
  const free = data.shop ? (data.shop.free_packs || 0) : 0;
  const stashN = data.shop && data.shop.stash ? Object.values(data.shop.stash.packs || {}).reduce((s, n) => s + (Number(n) || 0), 0) : 0;
  return h('div', { class: 'top' },
    h('button', { type: 'button', class: 'who panel', 'aria-label': 'Profile', title: `${name}, ${rk ? rk.label : 'unranked'}: your profile`, 'data-testid': 'dash-who', onclick: () => net.openProfile?.() },
      h('img', { class: 'av', src: avatarPicture(avatarId), alt: avatarName(avatarId) }),
      h('div', {}, h('b', {}, name), h('small', {}, rk ? ico(ladderCharm(rk.name)) : null, rk ? rk.label : 'Unranked'))),
    h('button', { type: 'button', class: 'coins panel', 'aria-label': `${coins == null ? '' : fmt(coins) + ' '}coins: open the shop`, 'data-testid': 'dash-coins', onclick: () => { void openScreen('shop'); } }, ico(COIN), coins == null ? '…' : fmt(coins), h('span', { class: 'plus' }, '+')),
    free > 0 || stashN > 0 ? h('button', { type: 'button', class: 'free panel', 'data-testid': 'dash-free', onclick: () => { void openScreen('shop'); } }, ico(FREEPACK), free > 0 ? `${free} free pack${free === 1 ? '' : 's'}` : `${stashN} sealed pack${stashN === 1 ? '' : 's'}`) : null,
    h('div', { class: 'grow' }),
    // Nov 6 (regions): the player's server and how many are on it; a tap opens the lobby where the server can be changed
    h('button', { type: 'button', class: 'server panel', 'data-testid': 'dash-server', title: 'Your server: change it in the PvP Lobby', onclick: () => net.openPvp?.('ranked') }, h('span', { class: 'dot' + (data.online ? '' : ' off') }), serverPillText(data.online)),
    ...extra,
    // Nov 7 (Ken): the friends list, and an Exit button near the gear
    h('button', { type: 'button', class: 'icn panel friends-btn', 'aria-label': 'Friends', title: 'Friends', 'data-testid': 'dash-friends', onclick: () => { void import('./friends').then((m) => m.showFriends()); } }, ico('/art/ui/silver/icon-deck.webp'), h('span', { class: 'fr-badge', 'data-friends-badge': '1', hidden: true })),
    h('button', { type: 'button', class: 'icn panel', 'aria-label': 'Settings', onclick: () => app?.showSettings() }, ico('/art/ui/silver/icon-settings.webp')),
    h('button', { type: 'button', class: 'icn panel exit-btn', 'aria-label': 'Exit', title: 'Exit or sign out', 'data-testid': 'dash-exit', onclick: () => { if (app) void import('./exit').then((m) => m.openExit(app!)); } }, ico('/art/ui/silver/icon-quit.webp')));
}

function rankPanel(data: Data, mini = false): El {
  const r = data.rank;
  const rk = r ? r.rank : rankOfRating(1000);
  const charm = ico(ladderCharm(rk.name));
  if (mini) return h('div', { class: 'rkmini' }, charm, h('div', {}, h('b', {}, rk.label), h('small', {}, r ? `${fmt(r.rating)} rating · ${r.games ? `${r.wins}-${r.losses}` : 'no ranked matches yet'}${r.season_end ? ` · season ends in ${untilWords(r.season_end)}` : ''}` : 'play a ranked match to be placed')));
  const pct = Math.round((rk.progress || 0) * 100);
  const steps = (r && r.ladder && r.ladder.length ? r.ladder : rankOfRating(1000) && []) as { name: string; min: number }[];
  return h('section', { class: 'panel rankcard', 'data-testid': 'dash-rank', 'aria-label': 'Your rank' },
    h('div', { class: 'ptitle h' }, ico(ladderCharm('diamond')), 'Your rank', h('button', { type: 'button', class: 'more', onclick: () => showRankings(app!) }, 'Rankings ›')),
    h('div', { class: 'rk' }, charm, h('div', {}, h('b', {}, rk.label), h('small', {}, r ? `Rating ${fmt(r.rating)}${r.place ? ` · #${r.place} on the server` : ''}` : 'Rating 1,000'), h('small', {}, r && r.games ? `${r.wins} win${r.wins === 1 ? '' : 's'} · ${r.losses} loss${r.losses === 1 ? '' : 'es'} this season` : 'No ranked matches yet this season'))),
    rk.next != null ? h('div', { class: 'prog' }, h('span', {}, `Progress to ${rk.division === 'I' ? (steps[rk.tier + 1] ? steps[rk.tier + 1].name + ' III' : 'the next step') : rk.name + ' ' + (rk.division === 'III' ? 'II' : 'I')}`), h('span', {}, `${r ? r.rating - rk.divFloor : 0} / ${(rk.divNext || 0) - rk.divFloor}`)) : h('div', { class: 'prog' }, h('span', {}, 'The top of the ladder')),
    rk.next != null ? h('div', { class: 'bar rank' }, h('i', { style: `width:${pct}%` })) : null,
    h('div', { class: 'ladder', 'aria-hidden': 'true' }, ...(steps.length ? steps : [{ name: rk.name, min: 0 }]).map((s) => ico(ladderCharm(s.name), s.name === rk.name ? 'on' : ''))),
    r && r.season_end ? h('div', { class: 'season' }, h('b', {}, `Season ${String(r.season || '').replace(/^\d{4}-/, '')} ends in`), h('span', {}, untilWords(r.season_end))) : null);
}

function questRows(q: QuestsInfo | null): El[] {
  if (!q) return [h('p', { class: 'dash-note' }, 'Quests could not be loaded.')];
  const rows = q.quests.map((x) => h('div', { class: 'q', 'data-testid': 'dash-quest' },
    h('span', {}, x.name), h('em', {}, ico(COIN), String(x.reward)),
    h('div', { class: 'bar' + (x.done ? ' done' : '') }, h('i', { style: `width:${Math.min(100, Math.round((x.progress / Math.max(1, x.target)) * 100))}%` })),
    h('small', {}, x.done ? 'Done! Collected.' : `${x.progress} / ${x.target}`)));
  const streakDays = 7, days = Math.min(streakDays, q.streak_days || 0);
  rows.push(h('div', { class: 'week', 'aria-label': `Quest streak: ${q.streak_days} days` }, h('span', {}, days >= streakDays ? 'Free pack earned' : `Free pack in ${streakDays - days} day${streakDays - days === 1 ? '' : 's'}`),
    ...Array.from({ length: streakDays }, (_, i) => h('i', { class: i < days ? 'on' : '' })), ico(FREEPACK)));
  return rows;
}

function newsBody(p: NewsPost | undefined, kind: 'patch' | 'news'): El[] {
  if (!p) return [h('p', { class: 'dash-note' }, kind === 'patch' ? 'No patch notes yet.' : 'No news yet.')];
  const out: El[] = [h('div', { class: 'ver' }, h('b', {}, p.title), h('span', {}, p.subtitle || ''))];
  const body: any = p.body;
  if (Array.isArray(body) && body.length && typeof body[0] === 'object' && body[0] && 'section' in body[0]) {
    for (const sec of body) {
      const label = ({ new: 'New', fixed: 'Fixed', known: 'Known issues', announce: 'Announcements' } as Record<string, string>)[sec.section] || sec.section;
      out.push(h('div', { class: `sec ${sec.section}` }, label), h('ul', { class: 'n' }, ...(sec.items || []).map((t: string) => { const li = h('li', {}); li.innerHTML = String(t).replace(/<(?!\/?b>)[^>]*>/g, ''); return li; })));
    }
  } else if (Array.isArray(body)) out.push(h('ul', { class: 'n' }, ...body.map((t: any) => h('li', {}, String(t)))));
  return out;
}
function eventRows(news: NewsFeed | null, withButtons = true): El[] {
  const evs = news ? news.events : [];
  if (!evs.length) return [h('p', { class: 'dash-note' }, 'No events yet.')];
  return evs.map((e) => { const [d, m] = dayWords(e.event_on); return h('div', { class: 'ev', 'data-testid': 'dash-event' },
    h('div', { class: 'date' }, h('b', {}, d || '—'), h('small', {}, m || 'TBA')),
    h('div', {}, h('h4', {}, e.title), h('p', {}, e.subtitle || (Array.isArray(e.body) ? e.body[0] : '') || '')),
    withButtons && e.action ? h('button', { type: 'button', class: 'sbtn panel' + (e.action === 'join' ? ' join' : ''), disabled: 'true', title: 'Tournaments are coming soon' }, e.action === 'join' ? 'Join' : 'Remind me', h('span', { class: 'soon' }, 'soon')) : h('span')); });
}

function build(root: El, data: Data) {
  const shop = data.shop, q = data.quests;
  const ownedN = data.owned ? Object.entries(data.owned).filter(([id, n]) => n > 0 && (CARDS[id] || id.startsWith('commander-'))).length : null;
  const allN = collectionCards().length;
  const freeN = shop ? shop.free_packs || 0 : 0;
  const stashN = shop && shop.stash ? Object.values(shop.stash.packs || {}).reduce((s, n) => s + (Number(n) || 0), 0) : 0;
  const doneN = q ? q.quests.filter((x) => x.done).length : 0;
  const deckN = net.decks.length;
  const rk = data.rank ? data.rank.rank : rankOfRating(1000);
  const cmdName = (() => { try { const p = JSON.parse(localStorage.getItem('oreheart.picks') || '{}'); return (COMMANDERS as any)[p.cmd]?.name || null; } catch { return null; } })();
  const modeChips = () => h('div', { class: 'mode', role: 'group', 'aria-label': 'How to play' }, ...MODES.map(([id, label]) => h('button', { type: 'button', class: 'chip panel' + (dashMode === id ? ' on' : ''), 'aria-pressed': String(dashMode === id), 'data-mode': id, onclick: (e: Event) => { dashMode = id; try { localStorage.setItem('oreheart.playMode', id); } catch { /* fine */ } for (const b of (e.currentTarget as El).parentElement!.querySelectorAll('.chip')) { b.classList.toggle('on', (b as El).dataset.mode === id); b.setAttribute('aria-pressed', String((b as El).dataset.mode === id)); } for (const s of root.querySelectorAll('.play-sub')) s.textContent = playSub(); } }, label)));
  const playSub = () => `${(MODES.find((m) => m[0] === dashMode) || MODES[0])[1]}${dashMode === 'ranked' ? ` · ${rk.label}` : ''}${cmdName ? ` · ${cmdName}` : ''}`;
  const go = () => {
    if (dashMode === 'computer') { app!.showSetup(); return; }
    net.openPvp?.(dashMode as 'ranked' | 'unranked' | 'friend');
  };
  const tile = (title: string, sub: string, art: El | null, onclick: () => void, testid: string, bg?: string) => h('button', { type: 'button', class: 'panel tile', 'data-testid': testid, 'aria-label': `${title}: ${sub}`, onclick },
    h('div', { class: 'art', style: bg || null }, art), h('div', { class: 'txt' }, h('div', { class: 'h' }, title), h('p', {}, sub)));
  const fan = h('div', { class: 'fan', 'aria-hidden': 'true' }, h('i', { style: 'background-image:url(/art/ui/oreheart-card-back.webp);transform:rotate(-14deg) translate(-40%,6%)' }), h('i', { style: 'background-image:url(/art/ui/oreheart-card-back.webp);transform:rotate(14deg) translate(40%,6%)' }), h('i', { style: 'background-image:url(/art/ui/oreheart-card-back.webp)' }));
  const charms = h('div', { class: 'charms', 'aria-hidden': 'true' }, ico(ladderCharm('sapphire')), ico(ladderCharm('ruby')), ico(ladderCharm(rk.name), 'mid'), ico(ladderCharm('diamond')), ico(ladderCharm('oreheart')));
  const whatsNew = (compact = false) => {
    const panel = h('section', { class: 'panel news', 'data-testid': compact ? 'dash-news-side' : 'dash-news', 'aria-label': "What's new" });
    const body = h('div', { class: 'pbody' });
    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const kinds: [string, string][] = [['patch', 'Patch notes'], ['events', 'Events'], ['news', 'News']];
    let cur = 'patch';
    const draw = () => {
      for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String((b as El).dataset.k === cur));
      body.replaceChildren(...(cur === 'patch' ? newsBody(data.news?.patch[0], 'patch') : cur === 'news' ? newsBody(data.news?.news[0], 'news') : eventRows(data.news, !compact)));
      if (cur === 'patch' && data.news && data.news.patch.length > 1) body.append(h('p', { class: 'ann' }, `${data.news.patch.length - 1} older patch${data.news.patch.length - 1 === 1 ? '' : 'es'} below`), ...data.news.patch.slice(1).flatMap((p) => newsBody(p, 'patch')));
    };
    tabs.append(...kinds.map(([k, label]) => h('button', { type: 'button', role: 'tab', 'data-k': k, 'aria-selected': String(k === cur), onclick: () => { cur = k; draw(); } }, label)));
    panel.append(compact ? tabs : h('div', { class: 'ptitle h' }, ico('/art/ui/silver/icon-howto.webp'), "What's new"), compact ? body : tabs, compact ? h('span') : body);
    draw();
    return panel;
  };
  root.append(topBar(data), h('div', { class: 'logo', 'aria-hidden': 'true' }),
    h('div', { class: 'main' },
      h('div', { class: 'col left' }, rankPanel(data),
        h('section', { class: 'panel', 'data-testid': 'dash-quests', 'aria-label': 'Daily quests', style: 'flex:1' },
          h('div', { class: 'ptitle h' }, ico(QUEST), 'Daily quests', h('button', { type: 'button', class: 'more', onclick: () => { void openScreen('quests'); } }, q && q.reroll_left > 0 ? 'Reroll · 1 free ›' : 'All quests ›')),
          ...questRows(q))),
      h('div', { class: 'grid' },
        h('div', { class: 'panel tile big', 'data-testid': 'dash-play' }, h('div', { class: 'art', style: 'background-image:url(/art/menu-front-oct29.webp);background-position:62% 70%' }),
          h('div', { class: 'txt' }, h('div', { class: 'h' }, 'Play'), h('p', { class: 'play-sub' }, playSub()), modeChips(),
            h('div', { class: 'play-row' },
              h('button', { type: 'button', class: 'btn panel play', 'data-testid': 'dash-find', onclick: go }, ico('/art/ui/silver/icon-play.webp'), 'Find a match'),
              // Nov 7 (Ken: "I'd also like a tutorial button"): the guided match (the Nov 1 tutorial) from the Dashboard
              h('button', { type: 'button', class: 'btn panel tut', 'data-testid': 'dash-tutorial', title: 'A short guided match that teaches the basics', onclick: () => app!.beginTutorial() }, ico('/art/ui/silver/icon-howto.webp'), 'Tutorial')))),
        tile('Deck Builder', `${deckN} deck${deckN === 1 ? '' : 's'}`, null, () => showDecks(app!), 'dash-decks', 'background:url(/art/owner/goblin/grubnak-on-throne-art.png) center 25%/cover no-repeat'),
        tile('Collection', ownedN == null ? `${allN} cards` : `${ownedN} / ${allN} cards`, fan, () => { void openScreen('collection'); }, 'dash-collection', 'background:radial-gradient(circle at 50% 35%,#2b2440,#0c0d14 70%)'),
        tile('Shop', freeN > 0 ? `${freeN} free pack${freeN === 1 ? '' : 's'} waiting` : stashN > 0 ? `${stashN} sealed pack${stashN === 1 ? '' : 's'} in My Packs` : 'Packs and bundles', null, () => { void openScreen('shop'); }, 'dash-shop', 'background:url(/art/packs/pack-general.webp) center 14%/56% no-repeat,radial-gradient(circle at 50% 35%,#2b3a66,#0c0d14 70%)'),
        tile('Rankings', 'Leaderboard · rank ladder', charms, () => showRankings(app!), 'dash-rankings', 'background:radial-gradient(circle at 50% 30%,#35265a,#0c0d14 72%)'),
        tile('Quests', q ? `${doneN} of ${q.quests.length} today` : 'Daily quests', null, () => { void openScreen('quests'); }, 'dash-questtile', `background:url(${QUEST}) center 14%/46% no-repeat,radial-gradient(circle at 50% 30%,#3a2e55,#0c0d14 70%)`),
        tile('Settings', 'Sound · display · account', null, () => app!.showSettings(), 'dash-settings', 'background:url(/art/ui/silver/icon-settings.webp) center 20%/34% no-repeat,radial-gradient(circle at 50% 30%,#2a2d36,#0c0d14 70%)')),
      // phone: six small tiles and the tabbed side panel (CSS shows these under 900px and hides the columns)
      h('div', { class: 'small', role: 'group', 'aria-label': 'Menu' },
        h('button', { type: 'button', class: 'panel', onclick: () => showDecks(app!) }, ico('/art/ui/silver/icon-deck.webp'), 'Decks'),
        h('button', { type: 'button', class: 'panel', onclick: () => { void openScreen('collection'); } }, h('img', { src: '/art/ui/oreheart-card-back.webp', alt: '', style: 'width:2em;height:3em;border-radius:3px;box-shadow:0 0 0 1px #c9d0da' }), 'Collection'),
        h('button', { type: 'button', class: 'panel', onclick: () => { void openScreen('shop'); } }, ico(FREEPACK), 'Shop'),
        h('button', { type: 'button', class: 'panel', onclick: () => showRankings(app!) }, ico(ladderCharm(rk.name)), 'Rankings'),
        h('button', { type: 'button', class: 'panel', onclick: () => { void openScreen('quests'); } }, ico(QUEST), 'Quests'),
        h('button', { type: 'button', class: 'panel', onclick: () => app!.showSettings() }, ico('/art/ui/silver/icon-settings.webp'), 'Settings')),
      h('div', { class: 'panel pside' }, rankPanel(data, true), (() => { const p = whatsNew(true); const t = p.querySelector('.tabs') as El; const first = t.querySelector('button') as El; const qb = h('button', { type: 'button', role: 'tab', 'data-k': 'quests', 'aria-selected': 'true' }, 'Quests'); const body = p.querySelector('.pbody') as El; const showQ = () => { for (const b of t.querySelectorAll('button')) b.setAttribute('aria-selected', String(b === qb)); body.replaceChildren(...questRows(q)); }; qb.onclick = showQ; t.prepend(qb); first.addEventListener('click', () => qb.setAttribute('aria-selected', 'false')); for (const b of t.querySelectorAll('button')) if (b !== qb) b.addEventListener('click', () => qb.setAttribute('aria-selected', 'false')); showQ(); return p; })()),
      h('div', { class: 'col right' }, whatsNew(),
        h('section', { class: 'panel', 'data-testid': 'dash-events', 'aria-label': 'Upcoming events' }, h('div', { class: 'ptitle h' }, ico(ladderCharm('oreheart')), 'Upcoming events'), ...eventRows(data.news)))));
}

/** Nov 6 (Ken approved the 11 screens): the D skin on a screen the checks drive. The screen's own DOM stays as it is; the
 *  shell goes around it: the top bar (filled from the Dashboard's data), '‹ Dashboard' and the title. `back` runs on the
 *  shell's back button; the screen keeps its own Back too. Nothing happens offline (the older look stays). */
export function dashSkin(main: HTMLElement, title: string, back: () => void, opts: { info?: string } = {}): void {
  if (!net.active || main.classList.contains('skin')) return;
  main.classList.add('dash', 'skin');
  const top = h('div', { class: 'top', 'aria-hidden': 'true' });
  const head = h('div', { class: 'hdr' }, h('button', { type: 'button', class: 'btn panel back-btn', 'data-testid': 'skin-back', onclick: back }, '‹ Dashboard'), h('div', { class: 'h ttl' }, title), opts.info ? h('div', { class: 'info' }, opts.info) : null);
  const body = h('div', { class: 'skin-body' });
  while (main.firstChild) body.append(main.firstChild);
  main.append(top, h('div', { class: 'logo', 'aria-hidden': 'true' }), head, body);
  void loadAll().then((d) => { if (top.isConnected) { const t = topBar(d); t.setAttribute('aria-hidden', 'true'); top.replaceWith(t); } }).catch(() => {});
}

/** The Rankings screen: the top of the season, your own row, the ladder and the season countdown (Ken, Nov 5). */
export async function showRankings(a: App): Promise<void> {
  app = a;
  a.clear();
  const root = h('main', { class: 'screen menu-screen dash rankings', 'data-screen': 'rankings', 'aria-label': 'Rankings' });
  a.root.append(root);
  const data = await loadAll();
  if (!root.isConnected) return;
  let lb: any = null;
  try { lb = await api.leaderboard(10); } catch { lb = null; }
  const me = data.rank, rk = me ? me.rank : rankOfRating(1000);
  const steps = (me && me.ladder && me.ladder.length ? me.ladder : []) as { name: string; min: number }[];
  const shares: Record<string, number> = (lb && lb.shares) || {};
  const total = (lb && Number(lb.players)) || 0;
  const rows: El[] = (lb && lb.top ? lb.top : []).map((p: any) => h('tr', { class: p.me ? 'me' : '', 'data-testid': 'rank-row' },
    h('td', {}, String(p.place)), h('td', {}, h('div', { class: 'pl' }, h('img', { src: avatarPicture(p.avatar), alt: '' }), h('span', {}, p.username))),
    h('td', {}, h('span', { class: 'lab' }, ico(ladderCharm(rankOfRating(p.rating, steps.length ? steps : undefined).name)), p.label)), h('td', {}, fmt(p.rating)), h('td', {}, `${p.wins}-${p.losses}`), h('td', {}, p.games ? `${Math.round((p.wins / p.games) * 100)}%` : '')));
  if (me && me.place && !(lb && lb.top && lb.top.some((p: any) => p.me))) rows.push(h('tr', { class: 'me', 'data-testid': 'rank-row' }, h('td', {}, String(me.place)), h('td', {}, h('div', { class: 'pl' }, h('img', { src: avatarPicture(net.avatar), alt: '' }), h('span', {}, getPlayerName()))), h('td', {}, h('span', { class: 'lab' }, ico(ladderCharm(rk.name)), rk.label)), h('td', {}, fmt(me.rating)), h('td', {}, `${me.wins}-${me.losses}`), h('td', {}, me.games ? `${Math.round((me.wins / me.games) * 100)}%` : '')));
  root.append(topBar(data), h('div', { class: 'logo', 'aria-hidden': 'true' }),
    h('div', { class: 'back' }, h('button', { type: 'button', class: 'btn panel', onclick: () => { void showDashboard(a); } }, '‹ Dashboard')),
    h('div', { class: 'main' },
      h('div', { class: 'col' }, h('section', { class: 'panel', 'data-testid': 'rankings-table', style: 'flex:1' },
        h('div', { class: 'rhead' }, h('div', { class: 'h' }, 'Rankings'), h('span', { class: 'dash-note' }, total ? `Season ${String(me?.season || '').replace(/^\d{4}-/, '')} · ${fmt(total)} ranked player${total === 1 ? '' : 's'}` : 'Nobody has played a ranked match this season yet')),
        rows.length ? h('table', { class: 'rtab' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Player'), h('th', {}, 'Rank'), h('th', {}, 'Rating'), h('th', {}, 'W-L'), h('th', {}, 'Win %'))), h('tbody', {}, ...rows)) : h('p', { class: 'dash-note' }, 'The first ranked match of the season starts the table. Rating goes up when you win and down when you lose; beating a higher rank gives more.'))),
      h('div', { class: 'col right' },
        h('section', { class: 'panel', 'data-testid': 'rank-ladder', 'aria-label': 'Rank ladder' }, h('div', { class: 'ptitle h' }, ico(ladderCharm(rk.name)), 'Rank ladder'),
          h('div', { class: 'ladder-big' }, ...(steps.length ? steps : [{ name: rk.name, min: 0 }]).map((s) => h('div', { class: s.name === rk.name ? 'on' : '' }, ico(ladderCharm(s.name)), h('b', {}, s.name), h('span', {}, total && shares[s.name] ? `${Math.round((shares[s.name] / total) * 100)}%` : `${s.min}+`)))),
          h('p', { class: 'dash-note' }, 'Each step has divisions III, II and I; Oreheart is the top, with no divisions. The rank is read off your rating.'),
          me && me.season_end ? h('div', { class: 'season' }, h('b', {}, 'Season ends in'), h('span', {}, untilWords(me.season_end))) : null),
        h('section', { class: 'panel', 'aria-label': 'Season rewards' }, h('div', { class: 'ptitle h' }, ico(FREEPACK), 'Season rewards'), h('p', { class: 'dash-note' }, 'Coming soon: rewards by your best rank of the season.')))));
  if (isTestPage()) (window as any).__rankings = { rows: rows.length, me: me ? me.rank.label : null };
}
