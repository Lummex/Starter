import './style.css';
import './ui/theme-silver.css'; // Ken (Oct 30): silver UI theme, loads after style.css so its rules win
import { startSilverFrames } from './ui/theme-silver';
import { Game } from './game';
import { onlineEnabled, pageMode } from './net/switch';
import { net } from './net/state';
import { App } from './ui/app';
import { getPlayerName, setPlayerName, AI_NAMES } from './ui/players';
import { rankOf, pointsFor, load as loadRank, save as saveRank, RANK_CONFIG } from './ui/rank';
import { ROSTER, matchRival } from './ui/roster';
import { STARTER_DECKS } from './engine';
import { STYLE_IDS, STYLE_LABEL, planFor } from './ai/styles';
import { aiChoose, makeRand, TUNE as AI_TUNE } from './ai/ai';
import { getPlayerAvatar, AVATARS } from './ui/avatars';
import { CARDS, COMMANDERS, CONFIG, ABILITIES, ABILITY_COST, brewActions, abilityStatusMap, flowShardCount, weaponOf, previewAttack, tutorialAction, STARTER_DECK_LIST, validateDeck } from './engine';
import { SPELL_VISUALS } from './content/spell-visuals';
import { spellFxLog, spellFxNow, spellFxAt, setSpellFxEnabled, SPELL_FX_SPEC, fxPhone, fxLayerUrl, FX_LAYERS } from './ui/spell-fx';
import { audio, VOICE, MIX, VOICE_DICE } from './ui/audio';
import { getHighlights, getRings } from './ui/fx-settings';
import { pictureOf, rarityKey, commanderPortrait, INTERNAL_ABILITY } from './ui/app';
import cardFormat from '../public/art/card-format/format.json';
import { ohCardEl, ohCardHTML, fitCardText, commanderCard } from './ui/cardfmt';
import { hasCreature3dSlug } from './ui/creature3d';
import { predictHit } from './ai/ai';
import { setDiceMode } from './engine/dice';
import { initOffline, offlineStatus, downloadAll as offlineDownloadAll } from './ui/offline';

const params = new URLSearchParams(location.search);
const test = params.get('test') === '1';
// Dice (Nov 1): a real match always rolls and shuffles fresh (dice.ts 'live'); only the hidden-check test pages use the seeded dice, so their replays stay step for step the same.
if (test) setDiceMode('seeded');
if (test) { try { localStorage.removeItem('oreheart.tutorialSeen'); } catch { /* ignore */ } }
const seedParam = params.get('seed');
const seed = seedParam != null && seedParam !== '' && !isNaN(+seedParam) ? Math.trunc(+seedParam) : 1;

// Offline app (Nov 2): the service worker runs in real play; test pages only with &sw=1, so the hidden checks never serve from a cache by accident
void initOffline(!test || params.get('sw') === '1');
const game = new Game(test);
const app = new App(document.getElementById('app')!, game, test, test ? seed : undefined);
const wantIntro = params.get('intro') === '1' || (!test && !sessionStorage.getItem('oreheart.introSeen'));
const pvpMock = test && params.get('pvp') === 'mock';
if (pvpMock) {
  // Nov 2 (PvP): test pages against the local mock server (tools/pvp-mock-server.mjs): signed in as ?user=<name>, no Supabase, no login
  import('./net/flow').then((m) => { app.menuHook = m.menuExtras; return m.startMockPvp(app, (params.get('user') || 'tester').slice(0, 24)); });
} else if (onlineEnabled || pageMode(location.search)) {
  // Online Phase A: login / parent pages first; the flow ends at the normal main menu
  import('./net/flow').then((m) => { app.menuHook = m.menuExtras; return m.startOnline(app); });
} else if (wantIntro) { try { sessionStorage.setItem('oreheart.introSeen', '1'); } catch { /* ignore */ } app.showIntro(); } else app.showMenu();
void net;

if (test) (window as any).__app = app;
if (test) (CONFIG as any).combat.dice = 'sure'; // test pages: every swing lands and nothing blocks, so the older checks keep their exact numbers; the combat v2 checks turn the dice on
if (test) VOICE.dice = null; // the voice checks need every trigger to pass the dice; AC550 checks the real dice
if (test) (window as any).__ohCard = (id: string, h = 624) => { const el = ohCardEl(CARDS[id], pictureOf(CARDS[id])); el.style.cssText = `width:${h * 420 / 624}px;height:${h}px;display:inline-block`; return el; };
if (test) {
  (window as any).oreheart = {
    renderCard: (id: string, px = 624) => {
      if (id === 'back') return ohCardHTML({ id: 'back', type: 'back', faction: 'goblins', name: '', text: '' }, null, px);
      const cmd = (COMMANDERS as any)[id.replace(/^cmd:/, '')];
      if (!CARDS[id] && cmd) return ohCardHTML(commanderCard(cmd), commanderPortrait(cmd.id), px);
      return ohCardHTML(CARDS[id], pictureOf(CARDS[id]), px);
    },
    fitText: (el: HTMLElement) => fitCardText(el),
    getState: () => app.game.getState(), // Nov 2: app.game is the friend match while one is on screen (NetGame), else the computer match
    getAiAudit: () => JSON.parse(JSON.stringify((globalThis as any).__aiAudit)),
    getAiInfo: () => ({ ...game.aiInfo }),
    getAiPace: () => JSON.parse(JSON.stringify({ paceLog: game.paceLog, aiLog: app.aiLog, busy: game.aiPace ? game.aiPace.busy() : null })),
    legalActions: () => (app.game.legalActions() as any[]).map((a: any) => (a.type === 'ability' && a.ability === 'shaman' && a.from ? { ...a, ability: 'pickUp', target: { ...a.from }, to: { ...a.target }, from: undefined } : a)).map((a: any) => { if (a.from === undefined) delete a.from; return a; }),
    act: (action: any) => {
      try { return app.game.act(action, true); } catch (e: any) { return { ok: false, error: String(e && e.message || e) }; }
    },
    newMatch: (options: any = {}) => app.beginMatch(options),
    startTutorial: () => app.beginTutorial(),
    movesLeft: () => app.game.movesLeft(),
    setMode: (m: string) => game.setMode(m),
    getMode: () => game.mode,
    setStance: (n: string) => { const r = game.setStance(n); app.refreshModeUi(); return r; },
    getStance: () => game.getStance(),
    stanceChoice: (uid?: string) => game.stanceChoice(uid),
    getDragCard: () => app.getDragCard(),
    getGuards: () => Object.fromEntries((app as any).guardSquares || []), // Nov 1: guard arrows (for the checks)
    offline: () => offlineStatus(), offlineDownloadAll: () => offlineDownloadAll(), // Nov 2: the offline app's status (for the checks)
    getOrders: () => app.getOrders(),
    setOrder: (o: any) => app.setOrder(o),
    cancelOrder: (uid: string) => app.cancelOrder(uid),
    orderPlan: (uid: string) => app.orderPlan(uid),
    getUiScales: () => app.getUiScales(),
    showCommanderSpeech: (side: string, text?: string) => app.showCommanderSpeech(side, text),
    getLiftState: () => app.getLiftState(),
    autoActStep: () => game.autoActStep(),
    setSpeed: (n: number) => { game.setSpeed(n); app.refreshModeUi(); },
    setPaused: (p: boolean) => { game.setPaused(p); app.refreshModeUi(); },
    previewAttack: (uid: string, target: any) => (game.state ? previewAttack(game.state, uid, target) : null),
    /** Oct 31: the computer's own damage prediction for a hit by `uid` on the creature at target {row, col} (ai.ts predictHit) */
    aiHitPrediction: (uid: string, target: any) => { const s: any = game.state; const c = s?.board.creatures.find((x: any) => x.uid === uid); const t = s?.board.creatures.find((x: any) => x.row === target?.row && x.col === target?.col); return c && t ? predictHit(s, c, t) : null; },
    tutorialAction: () => (game.state ? tutorialAction(game.state) : null),
    getCard: (id: string) => {
      const c: any = CARDS[id];
      if (!c) return null;
      const cr = c.type === 'creature';
      return { id: c.id, name: c.name, type: c.type, faction: c.faction === 'any' ? null : c.faction, disabled: !!c.disabled, rarity: c.rarity, role: cr ? String(c.role).toLowerCase() : null,
        cost: c.cost, attack: cr ? c.attack : null, health: cr ? c.health : null, move: cr ? c.move : null, range: cr ? (c.abilities?.includes('ranged') ? (c.range ?? CONFIG.rangedRange) : null) : null, artPos: c.artPos ?? { s: 1, x: 0, y: 0 }, abilities: c.abilities ?? [], text: c.text, shortText: c.shortText, longText: c.longText, weapon: weaponOf(c), tagline: c.tagline, visual: c.type === 'spell' ? (SPELL_VISUALS[c.id]?.id ?? null) : null, flavor: c.flavor, speed: c.type === 'spell' ? (c.spellKind === 'counter' ? 'counter' : c.spellKind === 'instant' ? 'instant' : 'regular') : null };
    },
    flowShardCount: (flow: number) => flowShardCount(flow),
    cardFormat: () => JSON.parse(JSON.stringify(cardFormat)),
    getAbilityButtons: () => {
      const st = game.state;
      return [...document.querySelectorAll<HTMLElement>('.ab-btn[data-ability]')].map((b) => {
        const uid = b.dataset.creatureUid!, k = b.dataset.ability!;
        const c = st?.board.creatures.find((x: any) => x.uid === uid);
        const r = b.getBoundingClientRect();
        return { uid, ability: k, cardId: c?.cardId ?? null, owner: c?.owner ?? null, cost: k === 'blink' ? 1 : (ABILITY_COST as any)[INTERNAL_ABILITY[k] || k] || 0, enabled: b.getAttribute('aria-disabled') !== 'true', icon: b.dataset.icon || '', label: b.getAttribute('aria-label') || '', rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
      });
    },
    getAbilityStatus: (uid?: string) => {
      if (!uid) return abilityStatusMap();
      const st = game.state;
      if (!st) return [];
      const legal: any[] = [...(game.legalActions() as any[]), ...brewActions(st, 'player'), ...brewActions(st, 'opponent')];
      const out: any[] = [];
      for (const c of st.board.creatures) {
        if (uid && c.uid !== uid) continue;
        for (const k of (CARDS[c.cardId].abilities || []) as string[]) {
          if (!(k in ABILITY_COST) && k !== 'blink' && k !== 'brew') continue;
          const cost = k === 'blink' ? 1 : ABILITY_COST[k] || 0;
          const usable = legal.some((a) => a.type === 'ability' && a.creatureUid === c.uid && a.ability === k);
          const used = k === 'brew' ? c.brewTurn === st.turn : k === 'blink' ? !!c.blinkUsed : k === 'ward' ? c.wardTurn === st.turn : !!(c.hasAttacked || c.hasMoved || c.hasMined);
          out.push({ uid: c.uid, cardId: c.cardId, owner: c.owner, ability: k, name: ABILITIES[k]?.name ?? k, text: ABILITIES[k]?.text ?? '', cost, usable, ready: usable, used, affordable: usable || !used });
        }
      }
      return out;
    },
    listCards: () => Object.keys(CARDS).filter((id) => !CARDS[id].disabled).map((id) => { const c = (window as any).oreheart.getCard(id); return { ...c, rarity: rarityKey(CARDS[id]) }; }),
    getArtInfo: (id: string) => {
      const c: any = CARDS[id];
      if (!c) return null;
      return { figure: c.type !== 'creature' ? null : c.faction === 'goblins' || hasCreature3dSlug(id) ? 'finished' : 'placeholder', picture: pictureOf(c) };
    },
    listStarterDecks: () => STARTER_DECK_LIST.map((d) => ({ id: d.id, name: d.name, faction: d.faction, style: d.style, cards: d.cards.slice() })),
    validateDeck: (ids: string[], commander?: string) => validateDeck(Array.isArray(ids) ? ids : [], commander),
    setIdleMs: (n: number) => { (app as any).idleMs = n; },
    getHandGlow: () => app.getHandGlow(),
    getSelectState: () => app.selState(),
    getHandHover: () => app.getHandHover(),
    advanceIdle: (n: number) => app.advanceIdle(n),
    getHandHoverBox: () => app.getHandHoverBox(),
    getHud: () => app.getHud(),
    getHudLayout: () => app.getHudLayout(),
    getTheme: (side: any) => app.getTheme(side),
    getDealLog: () => app.getDealLog(),
    getFlowStreams: () => app.getFlowStreams(),
    getDealState: () => app.getDealState(),
    getHighlightSettings: () => getHighlights(),
    getRingSettings: () => getRings(),
    getSelected: () => app.selectedUid,
    getAudioState: () => audio.state(),
    setVoicesOn: (on: boolean) => audio.setVoicesOn(on), // Oct 31: unit voices switch (off until Ken approves the reel)
    voiceEvent: (ev: 'select' | 'hurt' | 'special', unit: string, who: string, big?: boolean) => audio.speak(ev, unit, who, !!big),
    getPlayerName: () => getPlayerName(), setPlayerName: (n: string) => setPlayerName(n), getOpponentName: () => app.aiName, aiNames: () => AI_NAMES,
    getRank: () => ({ ...loadRank(), rank: rankOf(loadRank().points) }), setRankPoints: (n: number) => { const r = loadRank(); r.points = n; saveRank(r); return rankOf(n); }, // checks + Online Phase C
    rankOf: (p: number) => rankOf(p), rankPoints: (win: boolean, me: number, rival: number) => pointsFor(win, me, rival), rankConfig: () => RANK_CONFIG,
    getPlayerAvatar: () => getPlayerAvatar(), avatars: () => AVATARS,
    // Oct 31 (rival playstyles): the computer's style and plan; aiPlanFor reads a plan for any style on the current board; aiChooseOn runs the computer on a given state (the no-cheating check)
    aiStyles: () => STYLE_IDS.map((id) => ({ id, label: STYLE_LABEL[id] })), getAiStyle: () => game.aiStyle, setAiStyle: (id: string) => game.setAiStyle(id), aiPlan: () => game.aiPlan(),
    aiPlanFor: (style: any) => { const p = planFor(game.state, 'opponent', style); return { style: p.style, plan: p.plan, read: p.read }; },
    aiChooseOn: (state: any, difficulty: string, style: any, seed: number) => aiChoose(state, difficulty, makeRand(seed), undefined, style),
    setAiTune: (r: any) => { Object.assign(AI_TUNE, r); return { ...AI_TUNE }; }, /* checks only: a huge medMs makes Medium deterministic for the no-cheating check */
    starterDeckCards: (id: string) => (STARTER_DECKS as any)[id] || null,
    roster: () => ROSTER, getRival: () => app.rival, getRankResult: () => app.rankResult, matchRival: (pts: number, skill: string, pc?: string, oc?: string) => matchRival(pts, skill, pc, oc, () => 0), // Oct 31: the name plates (Online Phase A feeds the username via setPlayerNameProvider)
    setArenaPick: (who: '' | 'player' | 'opponent') => { app.arenaForce = who; return who; }, // checks only: force which faction's arena (and music) the next match uses
    setMixRules: (r: any) => { Object.assign(MIX, r); return { ...MIX }; }, // checks only: {enabled:false} plays every sound as asked (the sound-file checks), default is Brush's mix rules
    setVoiceRules: (r: any) => { Object.assign(VOICE, r); return { ...VOICE }; }, // checks only: shorten the voice cooldown / gap
    voiceDice: () => VOICE_DICE,
    setCombatRules: (r: any) => { Object.assign(CONFIG.combat, r); return { ...CONFIG.combat }; }, // checks only: {dice:'roll'} rolls the real dice on a test page, {dice:'sure'} lands every swing
    getCombatRules: () => ({ ...CONFIG.combat }),
    playSfx: (name: string, faction?: string) => audio.play(name, faction),
    playSpellSound: (id: string) => audio.spell(id),
    getRenderStats: async () => (app.view ? app.view.stats() : { webgl: false, graphics: app.low ? 'low' : 'high', drawCalls: 0, triangles: 0, bloom: false, shadows: false, particles: false, figures: [], commanders: { player: { commanderId: '', model: 'placeholder' }, opponent: { commanderId: '', model: 'placeholder' } }, strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished' }),
    getFxLog: () => JSON.parse(JSON.stringify((app as any).fxLog)),
    clearFxLog: () => { (app as any).fxLog = []; },
    /** Oct 31: every painted spell FX played (spell, beats with start times, layers, path, slow-mo, shake, word, reduced = phone set) */
    getSpellFxLog: () => JSON.parse(JSON.stringify(spellFxLog)),
    clearSpellFxLog: () => { spellFxLog.length = 0; },
    /** Oct 31: the live spell FX right now, each layer's computed state (scale in squares, alpha, square, ring normal) and the battle-cry glows */
    getSpellFxNow: () => JSON.parse(JSON.stringify(spellFxNow())),
    /** Oct 31: one FX's layers at a point of its own timeline (ms), live or recently finished */
    getSpellFxAt: (id: number, ms: number) => JSON.parse(JSON.stringify(spellFxAt(id, ms))),
    setSpellFxEnabled: (v: boolean) => setSpellFxEnabled(v),
    getSpellFxSpec: () => ({ loaded: !!SPELL_FX_SPEC?.spells, version: SPELL_FX_SPEC?.version, spells: Object.keys(SPELL_FX_SPEC?.spells || {}), phone: fxPhone(),
      files: Object.fromEntries(Object.keys(SPELL_FX_SPEC?.spells || {}).map((s) => [s, { pc: FX_LAYERS.map((l) => fxLayerUrl(s, l, false)), phone: FX_LAYERS.map((l) => fxLayerUrl(s, l, true)) }])) }),
    getCamera: () => app.getCamera(),
    getArena: () => app.getArena(),
    getPiecePoses: () => (app.view ? app.view.piecePoses() : {}),
    playEmote: (side: string, name: string) => app.view?.playEmote(side, name),
    focusCommander: (side: string) => app.view?.focusCommander(side),
    squareQuad: (r: number, c: number) => app.squareQuad(r, c),
    squareToScreen: (r: number, c: number) => app.squareToScreen(r, c),
    screenRects: () => app.screenRects(),
    poke: (uid: string) => (app.view ? app.view.poke(uid) : null),
    getConfig: () => JSON.parse(JSON.stringify(CONFIG)),
    setPhaseTimeLeft: (n: number) => app.setPhaseTimeLeft(n),
  };
  // Hooks never throw and newMatch never rejects, so the inspector always gets an answer.
  const hooks = (window as any).oreheart;
  for (const k of Object.keys(hooks)) {
    const f = hooks[k];
    hooks[k] = (...a: any[]) => { try { const r = f(...a); return r && typeof r.then === 'function' ? r.catch(() => null) : r; } catch (e) { console.warn('oreheart.' + k, e); return null; } };
  }
  // Nov 2 (PvP): window.oreheart.pvp = { create, join, view, act, forfeit, tick, seq } (each one guards itself; added after the wrapper because it is an object)
  const pvpLazy = () => import('./net/pvp').then((m) => m.pvpHooks() as any); // the PvP code stays out of the main bundle; every hook answers a promise
  hooks.pvp = Object.fromEntries(['create', 'join', 'view', 'act', 'forfeit', 'tick', 'seq', 'matchId', 'code', 'actLog'].map((k) => [k, (...a: any[]) => pvpLazy().then((p) => p[k](...a)).catch(() => null)]));
}

// "Please rotate" overlay: shown whenever the window is portrait and narrower than 900px.
const rotate = document.createElement('div');
rotate.className = 'rotate-overlay';
rotate.setAttribute('role', 'alert');
rotate.innerHTML = '<div class="rot-icon" aria-hidden="true">📱</div><p>Please rotate your phone</p>';
document.body.append(rotate);
// owner (Oct 25): on a computer (no touch screen) the game keeps its shape: it letterboxes to 16:9 in a browser
// window (zoom in/out still works) and never shows the phone rotate message. Phones and tablets work as before.
const isComputer = () => !(navigator.maxTouchPoints > 0 || matchMedia('(any-pointer: coarse)').matches);
const checkRotate = () => {
  const pc = isComputer();
  // phone-sized windows always fill the whole window edge to edge (AC24, AC138); every other computer window (tall, narrow, wide or large) letterboxes to 16:9
  document.documentElement.toggleAttribute('data-desk', pc && window.innerHeight > window.innerWidth);
  rotate.hidden = pc || !(window.innerHeight > window.innerWidth && window.innerWidth < 900);
};
checkRotate();
window.addEventListener('resize', checkRotate);
window.addEventListener('orientationchange', checkRotate);
startSilverFrames(); // Ken (Oct 30): gem caps of the silver buttons keep their shape (theme-silver.ts)
