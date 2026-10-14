import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './style.css';
import { cards, starterDecks, validateDeck } from './cards.js';
import { MODES, goldReward, resolveAttack } from './engine.js';
import { unlockAudio } from './audio.js';
import { loadMatch } from './store.js';
import * as UI from './ui.js';
import { mountMatch } from './match.js';

window.oreheart = {
  cards, starterDecks, validateDeck, resolveAttack,
  modes: MODES, goldReward,
};

const app = document.getElementById('app');
const nav = {
  go(name, arg) {
    app.replaceChildren();
    window.scrollTo(0, 0);
    if (name === 'match') return mountMatch(app, nav, arg);
    const fn = UI.screens[name] || UI.screens.menu;
    app.append(fn(nav, arg));
  },
};
document.addEventListener('pointerdown', unlockAudio, { once: true });
nav.go('menu');
void loadMatch;
