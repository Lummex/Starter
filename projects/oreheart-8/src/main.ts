import './style.css';
import { Game } from './game';
import { App } from './ui/app';
import { CARDS, CONFIG, weaponOf, previewAttack, tutorialAction, STARTER_DECK_LIST, validateDeck } from './engine';
import { SPELL_VISUALS } from './content/spell-visuals';
import { audio } from './ui/audio';
import { getHighlights, getRings } from './ui/fx-settings';
import { pictureOf, rarityKey } from './ui/app';

const params = new URLSearchParams(location.search);
const test = params.get('test') === '1';
const seedParam = params.get('seed');
const seed = seedParam != null && seedParam !== '' && !isNaN(+seedParam) ? Math.trunc(+seedParam) : 1;

const game = new Game(test);
const app = new App(document.getElementById('app')!, game, test, test ? seed : undefined);
const wantIntro = params.get('intro') === '1' || (!test && !sessionStorage.getItem('oreheart.introSeen'));
if (wantIntro) { try { sessionStorage.setItem('oreheart.introSeen', '1'); } catch { /* ignore */ } app.showIntro(); } else app.showMenu();

if (test) (window as any).__app = app;
{
  (window as any).oreheart = {
    getState: () => game.getState(),
    legalActions: () => game.legalActions(),
    act: (action: any) => {
      try { return game.act(action, true); } catch (e: any) { return { ok: false, error: String(e && e.message || e) }; }
    },
    newMatch: (options: any = {}) => app.beginMatch(options),
    startTutorial: () => app.beginTutorial(),
    movesLeft: () => game.movesLeft(),
    previewAttack: (uid: string, target: any) => (game.state ? previewAttack(game.state, uid, target) : null),
    tutorialAction: () => (game.state ? tutorialAction(game.state) : null),
    getCard: (id: string) => {
      const c: any = CARDS[id];
      if (!c) return null;
      const cr = c.type === 'creature';
      return { id: c.id, name: c.name, type: c.type, faction: c.faction === 'any' ? null : c.faction, disabled: !!c.disabled, rarity: c.rarity, role: cr ? String(c.role).toLowerCase() : null,
        cost: c.cost, attack: cr ? c.attack : null, health: cr ? c.health : null, move: cr ? c.move : null, text: c.text, shortText: c.shortText, longText: c.longText, weapon: weaponOf(c), tagline: c.tagline, visual: c.type === 'spell' ? (SPELL_VISUALS[c.id]?.id ?? null) : null, flavor: c.flavor, speed: c.type === 'spell' ? (c.spellKind === 'counter' ? 'counter' : c.spellKind === 'instant' ? 'instant' : 'regular') : null };
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
