import './style.css';
import { Game } from './game';
import { App } from './ui/app';
import { CARDS, CONFIG, weaponOf, previewAttack, tutorialAction } from './engine';
import { audio } from './ui/audio';
import { pictureOf } from './ui/app';

const params = new URLSearchParams(location.search);
const test = params.get('test') === '1';
const seedParam = params.get('seed');
const seed = seedParam != null && seedParam !== '' && !isNaN(+seedParam) ? Math.trunc(+seedParam) : 1;

const game = new Game(test);
const app = new App(document.getElementById('app')!, game, test, test ? seed : undefined);
app.showMenu();

if (test) {
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
      return { id: c.id, name: c.name, type: c.type, faction: c.faction === 'any' ? null : c.faction, rarity: c.rarity, role: cr ? String(c.role).toLowerCase() : null,
        cost: c.cost, attack: cr ? c.attack : null, health: cr ? c.health : null, move: cr ? c.move : null, text: c.text, shortText: c.shortText, longText: c.longText, weapon: weaponOf(c), tagline: c.tagline, flavor: c.flavor };
    },
    listCards: () => Object.keys(CARDS).map((id) => (window as any).oreheart.getCard(id)),
    getArtInfo: (id: string) => {
      const c: any = CARDS[id];
      if (!c) return null;
      return { figure: c.type !== 'creature' ? null : c.faction === 'goblins' ? 'finished' : 'placeholder', picture: pictureOf(c) };
    },
    getAudioState: () => audio.state(),
    getRenderStats: async () => (app.view ? app.view.stats() : { webgl: false, graphics: app.low ? 'low' : 'high', drawCalls: 0, triangles: 0, bloom: false, shadows: false, particles: false, figures: [], commanders: { player: { commanderId: '', model: 'placeholder' }, opponent: { commanderId: '', model: 'placeholder' } }, strongholds: { player: 'finished', opponent: 'finished' }, mines: 'finished' }),
    getFxLog: () => JSON.parse(JSON.stringify((app as any).fxLog)),
    clearFxLog: () => { (app as any).fxLog = []; },
    getCamera: () => app.getCamera(),
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
