import './style.css';
import { Game } from './game';
import { App } from './ui/app';
import { CARDS, CONFIG } from './engine';

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
    getCard: (id: string) => {
      const c: any = CARDS[id];
      if (!c) return null;
      const cr = c.type === 'creature';
      return { id: c.id, name: c.name, type: c.type, faction: c.faction === 'any' ? null : c.faction, rarity: c.rarity, role: cr ? String(c.role).toLowerCase() : null,
        cost: c.cost, attack: cr ? c.attack : null, health: cr ? c.health : null, move: cr ? c.move : null };
    },
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
