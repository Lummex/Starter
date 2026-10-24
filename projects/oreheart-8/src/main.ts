import './style.css';
import { Game } from './game';
import { App } from './ui/app';
import { CARDS, COMMANDERS, CONFIG, ABILITIES, ABILITY_COST, brewActions, abilityStatusMap, flowShardCount, weaponOf, previewAttack, tutorialAction, STARTER_DECK_LIST, validateDeck } from './engine';
import { SPELL_VISUALS } from './content/spell-visuals';
import { audio } from './ui/audio';
import { getHighlights, getRings } from './ui/fx-settings';
import { pictureOf, rarityKey, commanderPortrait, INTERNAL_ABILITY } from './ui/app';
import cardFormat from '../public/art/card-format/format.json';
import { ohCardEl, ohCardHTML, fitCardText, commanderCard } from './ui/cardfmt';

const params = new URLSearchParams(location.search);
const test = params.get('test') === '1';
if (test) { try { localStorage.removeItem('oreheart.tutorialSeen'); } catch { /* ignore */ } }
const seedParam = params.get('seed');
const seed = seedParam != null && seedParam !== '' && !isNaN(+seedParam) ? Math.trunc(+seedParam) : 1;

const game = new Game(test);
const app = new App(document.getElementById('app')!, game, test, test ? seed : undefined);
const wantIntro = params.get('intro') === '1' || (!test && !sessionStorage.getItem('oreheart.introSeen'));
if (wantIntro) { try { sessionStorage.setItem('oreheart.introSeen', '1'); } catch { /* ignore */ } app.showIntro(); } else app.showMenu();

if (test) (window as any).__app = app;
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
    getState: () => game.getState(),
    legalActions: () => game.legalActions(),
    act: (action: any) => {
      try { return game.act(action, true); } catch (e: any) { return { ok: false, error: String(e && e.message || e) }; }
    },
    newMatch: (options: any = {}) => app.beginMatch(options),
    startTutorial: () => app.beginTutorial(),
    movesLeft: () => game.movesLeft(),
    setMode: (m: string) => game.setMode(m),
    getMode: () => game.mode,
    setStance: (n: string) => { const r = game.setStance(n); app.refreshModeUi(); return r; },
    getStance: () => game.getStance(),
    stanceChoice: (uid?: string) => game.stanceChoice(uid),
    autoActStep: () => game.autoActStep(),
    setSpeed: (n: number) => { game.setSpeed(n); app.refreshModeUi(); },
    setPaused: (p: boolean) => { game.setPaused(p); app.refreshModeUi(); },
    previewAttack: (uid: string, target: any) => (game.state ? previewAttack(game.state, uid, target) : null),
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
      return { figure: c.type !== 'creature' ? null : c.faction === 'goblins' ? 'finished' : 'placeholder', picture: pictureOf(c) };
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
    getRenderStats: async () => (app.view ? app.view.stats() : { webgl: false, graphics: app.low ? 'low' : 'high', drawCalls: 0, triangles: 0, bloom: false, shadows: false, particles: false, figures: [], commanders: { player: { commanderId: '', model: 'placeholder' }, opponent: { commanderId: '', model: 'placeholder' } }, strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished' }),
    getFxLog: () => JSON.parse(JSON.stringify((app as any).fxLog)),
    clearFxLog: () => { (app as any).fxLog = []; },
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
}

// "Please rotate" overlay: shown whenever the window is portrait and narrower than 900px.
const rotate = document.createElement('div');
rotate.className = 'rotate-overlay';
rotate.setAttribute('role', 'alert');
rotate.innerHTML = '<div class="rot-icon" aria-hidden="true">📱</div><p>Please rotate your phone</p>';
document.body.append(rotate);
const checkRotate = () => { rotate.hidden = !(window.innerHeight > window.innerWidth && window.innerWidth < 900); };
checkRotate();
window.addEventListener('resize', checkRotate);
window.addEventListener('orientationchange', checkRotate);
