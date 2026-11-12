// Tutorial v2 (Nov 8; Ledger's spec studio/specs/tutorial-v2.md, Ken: "When the finger goes to point at the stuff, it's kind of confusing.
// It needs to say ... click the menu here underneath the finger ... Show them everything that needs to be explained.")
// One component for every step: Brush's pointing finger with its fingertip ON the target, a word bubble right beside it (WHAT it is, WHAT
// to do), a blinking ring around the target and, on the tour steps, a soft veil with a hole. All of it lives in one fixed layer on
// document.body (.tut2-layer, z-index 10000), above the HUD, dialogs and the card view; only the bubble's buttons take clicks.
// Chapters: 1 the battle screen, 2 reading a card, 3 units, 4 a first battle (real turns, scripted dice), 5 a practice skirmish
// (a goal list, idle help), 6 the clever tricks (today's lessons from 'order' on, src/ui/tutorial.ts). The words are in
// src/content/tutorial.json "v2"; this file keeps the targets, goals and boards by step id.
import TUT from '../content/tutorial.json';
import { CARDS, ABILITY_COST, markTutorialDone, legalActions, creatureCost, applyAction } from '../engine';

type El = HTMLElement;
type Cell = { row: number; col: number };
type Box = { x: number; y: number; w: number; h: number };
type Advance = 'ok' | 'target' | 'goal';
type Place = 'above' | 'below' | 'left' | 'right' | 'centre';
const PIC = (n: string) => `/art/tutorial/${n}.webp`;
const V2: any = (TUT as any).v2;
const MINES = [{ row: 3, col: 5 }, { row: 4, col: 7 }, { row: 5, col: 9 }];
const ENEMY_SH: Cell = { row: 1, col: 12 };
const P = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'player', row, col, ...x });
const O = (cardId: string, row: number, col: number, x: any = {}) => ({ cardId, owner: 'opponent', row, col, ...x });
const many = (id: string, n: number) => Array(n).fill(id);
const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
const phone = () => innerWidth <= 900 || document.documentElement.dataset.display === 'phone';

/** one step: where it points, how it goes on, and (goal steps) when it is done */
interface Step {
  id: string;
  target?: (t: Tutorial2, st: any) => Element | Box | null;
  /** extra rings (e.g. all three mines) */
  rings?: (t: Tutorial2, st: any) => (Element | Box | null)[];
  advance: Advance;
  goal?: (t: Tutorial2, st: any) => boolean;
  place?: Place; placePhone?: Place;
  veil?: boolean;
  /** an animated drag for the finger (from -> to) instead of a tap */
  drag?: (t: Tutorial2, st: any) => { from: Element | Box | null; to: Element | Box | null } | null;
  enter?: (t: Tutorial2, st: any) => void;
  /** the card whose numbers fill {cost} {atk} ... */
  card?: string;
  /** small ring (card numbers) */
  tight?: boolean;
}
interface Chapter { id: string; setup: (t: Tutorial2) => any; steps: Step[]; veil: boolean; card: string; after?: (t: Tutorial2) => void }

const rectOf = (x: Element | Box | null | undefined): Box | null => {
  if (!x) return null;
  let b: Box;
  if ((x as any).getBoundingClientRect) { const r = (x as Element).getBoundingClientRect(); if (!r.width && !r.height) return null; b = { x: r.left, y: r.top, w: r.width, h: r.height }; }
  else { b = x as Box; if (!b.w && !b.h) return null; }
  // the part on screen (a resting hand card hangs below the edge): the finger and the ring go where the player can see and press
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(innerWidth, b.x + b.w), y1 = Math.min(innerHeight, b.y + b.h);
  return x1 - x0 >= 4 && y1 - y0 >= 4 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : b;
};
const q = (sel: string, root: ParentNode = document) => root.querySelector(sel) as El | null;

// ---------------------------------------------------------------- chapter boards
const base = (board: any[], hand: string[], crystals: number, extra: any = {}) => ({
  _board: board,
  playerCommander: 'grubnak', opponentCommander: 'borgo', mines: MINES, seed: 1, difficulty: 'easy', tutorial: 'v2', tutorialInfo: {},
  setup: { firstPlayer: 'player', board: board.map(({ hp: _hp, ...b }) => b), playerHand: hand, playerCrystals: crystals, opponentHand: [],
    playerDeck: many('goblin-grunt', 6), opponentDeck: many('dwarf-pickman', 6), ...extra },
});

// ---------------------------------------------------------------- targets
const T = {
  menu: (t: Tutorial2) => t.app.r?.menuBtn || (t.app.r?.menuWrap?.querySelector('.menu-btn') as El | null) || q('[data-role=menu-button] .menu-btn') || q('[data-role=menu-button]'), // the button itself (the wrap grows with the open panel)
  menuPanel: (t: Tutorial2) => t.app.r?.menuPanel || q('#match-menu-panel'),
  myAvatar: (t: Tutorial2) => q('[data-testid=emote-avatar]') || (t.app.r?.myName?.querySelector('.o-av') as El | null),
  enemyAvatar: (t: Tutorial2) => (t.app.r?.eName?.querySelector('.o-av') as El | null) || t.app.r?.eName || null,
  myHealth: (t: Tutorial2) => t.app.r?.myHealth || null,
  enemyHealth: (t: Tutorial2) => t.app.r?.enemyHealth || null,
  flow: (t: Tutorial2) => q('[data-role=player-flow-crystal]') || t.app.r?.crFlow || null,
  bank: (t: Tutorial2) => q('[data-role=player-bank]') || t.app.r?.crBank || null,
  nextFlow: (t: Tutorial2) => q('[data-role=player-next-flow]') || t.app.r?.income || null,
  phases: (t: Tutorial2) => q('[data-role=phase-list]') || (t.app.r?.phase?.querySelector('.ph-steps') as El | null) || t.app.r?.phase || null,
  done: (t: Tutorial2) => t.app.r?.done || q('[data-role=done-button]'),
  myDeck: (t: Tutorial2) => q('[data-role=player-deck]') || t.app.r?.myDeck || null,
  myDeckCount: (t: Tutorial2) => q('[data-role=player-deck] .pile-n') || (t.app.r?.myDeck?.querySelector('.pile-n') as El | null) || null,
  enemyDeck: (t: Tutorial2) => q('[data-role=enemy-deck]') || t.app.r?.enemyDeck || null,
  enemyHand: (t: Tutorial2) => q('[data-role=enemy-hand]') || t.app.r?.enemyHand || null,
  hand: (t: Tutorial2) => q('[data-role=player-hand]') || t.app.r?.hand || null,
  handCard: (_t: Tutorial2, id?: string) => q(id ? `.hand .hand-card[data-card-id="${id}"]:not(.popclone)` : '.hand .hand-card:not(.popclone)'),
  cardView: () => q('.dialog .card-view-face .hand-card.big'),
  part: (p: string) => () => q(`.dialog .card-view-face [data-part="${p}"]`),
  playThis: () => q('.dialog .play-from-hand'),
  turnBanner: (t: Tutorial2) => q('[data-role=turn-banner]') || (t.app.r?.phase?.querySelector('.ph-turn') as El | null) || null,
};
const unitOf = (t: Tutorial2, owner: 'player' | 'opponent', cardId?: string) => (t.app.game.state?.board.creatures || []).find((c: any) => c.owner === owner && (!cardId || c.cardId === cardId)) || null;
const tokenOf = (t: Tutorial2, c: any): El | null => (c ? (t.app.tokens?.get(c.uid) as El | undefined) || null : null);

// ---------------------------------------------------------------- the five chapters
function chapters(): Chapter[] {
  const tour: Step[] = [
    { id: 'tour-hello', advance: 'ok', place: 'centre' },
    { id: 'tour-menu', target: (t) => T.menu(t), advance: 'target', place: 'right', placePhone: 'below' },
    { id: 'tour-menu-panel', target: (t) => T.menuPanel(t), advance: 'ok', place: 'right', placePhone: 'below', enter: (t) => { if (!t.app.menuPinned) { t.app.menuPinned = true; t.app.menuOpen?.(true); } } },
    { id: 'tour-menu-close', target: (t) => T.menu(t), advance: 'target', place: 'right', placePhone: 'below', goal: (t) => !t.app.r?.menuWrap?.classList.contains('open') },
    { id: 'tour-emote', target: (t) => T.myAvatar(t), advance: 'target', place: 'right', placePhone: 'above', goal: () => !!q('.emote-dial, [data-testid=emote-dial], .emote-pick') },
    { id: 'tour-emote-send', target: () => q('.emote-pick[data-emote="free-starter/hello"]') || q('.emote-pick'), advance: 'goal', place: 'right', placePhone: 'above', veil: false,
      goal: (t) => !!t.flags.emoted, enter: (t) => t.watchEmote() },
    { id: 'tour-emote-mute', target: (t) => T.myAvatar(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'tour-my-health', target: (t) => T.myHealth(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'tour-enemy', target: (t) => T.enemyAvatar(t), advance: 'ok', place: 'left', placePhone: 'below' },
    { id: 'tour-enemy-health', target: (t) => T.enemyHealth(t), advance: 'ok', place: 'left', placePhone: 'below' },
    { id: 'tour-flow', target: (t) => T.flow(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'tour-bank', target: (t) => T.bank(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'tour-next', target: (t) => T.nextFlow(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'tour-mines', target: (t) => t.square(MINES[1]), rings: (t) => MINES.map((m) => t.square(m)), advance: 'ok', place: 'above', placePhone: 'above' },
    { id: 'tour-phases', target: (t) => T.phases(t), advance: 'ok', place: 'left', placePhone: 'above' },
    { id: 'tour-done', target: (t) => T.done(t), advance: 'ok', place: 'left', placePhone: 'above' },
    { id: 'tour-deck', target: (t) => T.myDeck(t), advance: 'ok', place: 'above', placePhone: 'above' },
    { id: 'tour-enemy-deck', target: (t) => T.enemyDeck(t), rings: (t) => [T.enemyHand(t)], advance: 'ok', place: 'below', placePhone: 'below' },
    { id: 'tour-hand', target: (t) => T.hand(t), advance: 'ok', place: 'above', placePhone: 'above' },
  ];
  const cardPart = (id: string, part: string, place: Place = 'right', ring?: string): Step => ({ id, target: T.part(part), rings: ring ? () => [T.part(ring)()] : undefined, advance: 'ok', place, placePhone: 'below', tight: true, card: 'goblin-grunt',
    enter: (t) => t.keepCardOpen() });
  const cardSteps: Step[] = [
    { id: 'card-open', target: (t) => T.handCard(t, 'goblin-grunt'), advance: 'target', place: 'above', placePhone: 'above', card: 'goblin-grunt', goal: () => !!T.cardView() },
    cardPart('card-cost', 'cost'), cardPart('card-attack', 'attack'), cardPart('card-health', 'health'), cardPart('card-feet', 'move', 'left'),
    cardPart('card-type', 'typeIcon', 'left'), cardPart('card-name', 'name', 'above'), cardPart('card-text', 'text', 'above'), cardPart('card-rarity', 'rarity', 'above', 'rarityGem'), cardPart('card-faction', 'frame'),
    { id: 'card-play', target: () => T.playThis(), advance: 'goal', place: 'above', placePhone: 'above', card: 'goblin-grunt', veil: false,
      goal: (t, st) => !!t.app.pick || st.board.creatures.some((c: any) => c.owner === 'player'), enter: (t) => t.keepCardOpen() },
  ];
  const brawler = (t: Tutorial2) => unitOf(t, 'player', 'goblin-scrapper');
  const cadet = (t: Tutorial2) => unitOf(t, 'opponent');
  const badge = (t: Tutorial2, c: any, stat?: string) => { const tk = tokenOf(t, c); return tk ? (tk.querySelector(stat ? `[data-unit-badge] [data-stat=${stat}]` : '[data-unit-badge]') as El | null) : null; };
  const abBtn = (t: Tutorial2) => { const tk = tokenOf(t, brawler(t)); return (tk?.querySelector('.ab-btn[data-ability=strike]') as El | null) || q('.ab-btn[data-ability=strike]'); };
  const unitSteps: Step[] = [
    { id: 'unit-hello', target: (t) => tokenOf(t, brawler(t)), advance: 'ok', place: 'above', placePhone: 'above', card: 'goblin-scrapper' },
    { id: 'unit-attack', target: (t) => badge(t, brawler(t), 'attack'), advance: 'ok', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'unit-health', target: (t) => badge(t, brawler(t), 'health'), advance: 'ok', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'unit-feet', target: (t) => badge(t, brawler(t), 'movement'), advance: 'ok', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'unit-type', target: (t) => { const tk = tokenOf(t, brawler(t)); return (tk?.querySelector('.ub-icon') as El | null) || abBtn(t) || badge(t, brawler(t)); }, advance: 'ok', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'unit-ability', target: (t) => abBtn(t), advance: 'ok', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'ability-off', target: (t) => abBtn(t), advance: 'target', place: 'right', placePhone: 'above', tight: true, card: 'goblin-scrapper' },
    { id: 'enemy-stats', target: (t) => badge(t, cadet(t)), advance: 'ok', place: 'left', placePhone: 'below', card: 'goblin-scrapper' },
    { id: 'tap-unit', target: (t) => tokenOf(t, brawler(t)), advance: 'goal', place: 'above', placePhone: 'above', card: 'goblin-scrapper', goal: (t) => !!t.app.stanceBar, veil: false },
    { id: 'stances', target: (t) => t.app.stanceBar || null, advance: 'ok', place: 'below', placePhone: 'below', card: 'goblin-scrapper', veil: false },
    { id: 'card-again', target: (t) => tokenOf(t, brawler(t)), advance: 'ok', place: 'above', placePhone: 'above', card: 'goblin-scrapper', enter: (t) => t.app.closeStanceBar?.() },
  ];
  // Nov 11 (Ken: "show them the dragging moves before they actually play ... the dragging and the attacking, with the where you drag it"):
  // a hands-on drag lesson before the first battle. Drag the Grunt to the glowing square (every square he can walk to is marked), then
  // drag him onto the dwarf beside it. Each step goes on only when the drag really happened.
  const DRAG_TO = { row: 5, col: 6 }, DRAG_FOE = { row: 4, col: 7 };
  const dGrunt = (t: Tutorial2) => unitOf(t, 'player', 'goblin-grunt');
  const dFoe = (t: Tutorial2) => unitOf(t, 'opponent');
  const walkSquares = (t: Tutorial2) => { const g = dGrunt(t); if (!g) return []; const seen = new Set<string>(); return (t.app.game.legalActions?.() || []).filter((a: any) => a.type === 'move' && a.creatureUid === g.uid && !(a.row === DRAG_TO.row && a.col === DRAG_TO.col) && !seen.has(a.row + ',' + a.col) && seen.add(a.row + ',' + a.col)).slice(0, 24).map((a: any) => t.square(a)); };
  const dragSteps: Step[] = [
    { id: 'drag-move', advance: 'goal', place: 'above', placePhone: 'above', card: 'goblin-grunt', veil: false, target: (t) => t.square(DRAG_TO), rings: walkSquares,
      drag: (t) => ({ from: tokenOf(t, dGrunt(t)), to: t.square(DRAG_TO) }), goal: (t) => { const g = dGrunt(t); return !!g && g.row === DRAG_TO.row && g.col === DRAG_TO.col; } },
    { id: 'drag-attack', advance: 'goal', place: 'above', placePhone: 'above', card: 'goblin-grunt', veil: false, target: (t) => { const f = dFoe(t); return f ? t.square(f) : null; },
      drag: (t) => { const f = dFoe(t); return { from: tokenOf(t, dGrunt(t)), to: f ? t.square(f) : null }; },
      enter: (_t, st) => { if (st.tutorial) st.tutorial.rolls = ['hit', 'hit', 'miss', 'miss']; }, goal: (t) => !!t.flags.attacked },
    { id: 'drag-done', advance: 'ok', place: 'centre', enter: (_t, st) => { if (st.tutorial) st.tutorial.rolls = []; } },
  ];
  // chapter 4: real turns. The Grunt costs what the card says; the dwarf stands at (4,7) and steps to (4,6) on the enemy turn.
  const grunt = (t: Tutorial2) => unitOf(t, 'player', 'goblin-grunt');
  const miner = (t: Tutorial2) => unitOf(t, 'player', 'goblin-scrounger');
  const dwarf = (t: Tutorial2) => unitOf(t, 'opponent');
  const myTurn = (st: any, phase: string) => st.activePlayer === 'player' && st.phase === phase && st.priority === 'player' && !st.pendingResponse;
  const battle: Step[] = [
    { id: 'deploy', advance: 'goal', place: 'above', placePhone: 'above', card: 'goblin-grunt', target: (t) => t.square({ row: 7, col: 6 }), drag: (t) => ({ from: T.handCard(t, 'goblin-grunt'), to: t.square({ row: 7, col: 6 }) }),
      goal: (t) => !!grunt(t) },
    { id: 'deploy-paid', target: (t) => T.flow(t), advance: 'ok', place: 'right', placePhone: 'above', card: 'goblin-grunt' },
    { id: 'done-deploy', target: (t) => T.done(t), advance: 'goal', place: 'left', placePhone: 'above', goal: (_t, st) => st.phase === 'action' },
    { id: 'action-phase', target: (t) => T.phases(t), advance: 'ok', place: 'left', placePhone: 'above' },
    { id: 'new-units-wait', target: (t) => T.done(t), rings: (t) => [tokenOf(t, grunt(t))], advance: 'goal', place: 'left', placePhone: 'above', goal: (_t, st) => st.activePlayer !== 'player' || st.turn > 1 },
    { id: 'enemy-turn', target: (t) => T.turnBanner(t), advance: 'goal', place: 'left', placePhone: 'below', goal: (_t, st) => st.turn > 1 && st.activePlayer === 'player' && st.phase === 'deploy' && st.priority === 'player' },
    { id: 'draw', target: (t) => T.myDeckCount(t) || T.myDeck(t), advance: 'ok', place: 'above', placePhone: 'above', enter: (t) => t.gift(1) },
    { id: 'miner', advance: 'goal', place: 'above', placePhone: 'above', target: (t) => t.square({ row: 7, col: 5 }), drag: (t) => ({ from: T.handCard(t, 'goblin-scrounger'), to: t.square({ row: 7, col: 5 }) }), goal: (t) => !!miner(t) },
    { id: 'done-deploy-2', target: (t) => T.done(t), advance: 'goal', place: 'left', placePhone: 'above', goal: (_t, st) => st.phase === 'action' },
    { id: 'move', advance: 'goal', place: 'above', placePhone: 'above', target: (t) => t.square({ row: 5, col: 6 }), drag: (t) => ({ from: tokenOf(t, grunt(t)), to: t.square({ row: 5, col: 6 }) }),
      goal: (t) => { const g = grunt(t); return !!g && g.row === 5 && g.col === 6; } },
    { id: 'preview', advance: 'goal', place: 'above', placePhone: 'above', target: (t) => { const d = dwarf(t); return d ? t.square(d) : null; },
      drag: (t) => { const d = dwarf(t); return { from: tokenOf(t, grunt(t)), to: d ? t.square(d) : null }; },
      enter: (t, st) => { if (st.tutorial) { const g = grunt(t); const n = Math.max(2, (g && g.attack) || 2); st.tutorial.rolls = ['hit', 'block', ...Array(n - 2).fill('miss'), 'miss', 'miss']; } }, goal: (t) => { const g = grunt(t); return !!g && !!(g.hasAttacked || (g.movesLeft ?? 1) === 0); } },
    { id: 'dice', advance: 'ok', place: 'centre', enter: (t, st) => { if (st.tutorial) st.tutorial.rolls = []; t.later(t.fast ? 50 : 1800, () => t.refresh()); } }, // the scripted fight is over: no leftover rolls
    { id: 'strike-back', target: (t) => tokenOf(t, grunt(t)), advance: 'ok', place: 'above', placePhone: 'above' },
    { id: 'mine', advance: 'goal', place: 'above', placePhone: 'above', target: (t) => t.square(MINES[0]),
      enter: (t, st) => { const m = miner(t); if (m && !(m.row === 4 && m.col === 5) && !st.board.creatures.some((c: any) => c.row === 4 && c.col === 5)) { m.row = 4; m.col = 5; t.app.update?.(st, []); } },
      drag: (t) => ({ from: tokenOf(t, miner(t)), to: t.square(MINES[0]) }), goal: (t) => { const m = miner(t); return !!m && !!m.hasMined; } },
    { id: 'income', target: (t) => T.nextFlow(t), advance: 'ok', place: 'right', placePhone: 'above' },
    { id: 'end-turn', target: (t) => T.done(t), advance: 'goal', place: 'left', placePhone: 'above', enter: (t, st) => { t.flags.endFrom = st.turn; }, goal: (t, st) => st.turn > (t.flags.endFrom ?? 99) && myTurn(st, 'action') },
    { id: 'commander', advance: 'goal', place: 'left', placePhone: 'below', target: (t) => t.square(ENEMY_SH),
      enter: (t, st) => { const g = grunt(t); if (g && !(g.row === 2 && g.col === 11)) { g.row = 2; g.col = 11; g.hasMoved = false; g.hasAttacked = false; t.app.update?.(st, []); } if (st.tutorial) st.tutorial.rolls = ['hit', 'hit', 'hit']; },
      drag: (t) => ({ from: tokenOf(t, grunt(t)), to: t.square(ENEMY_SH) }), goal: (_t, st) => st.phase === 'over' || (st.players?.opponent?.health ?? 20) <= 0 },
    { id: 'win', target: (t) => T.enemyHealth(t), advance: 'ok', place: 'left', placePhone: 'below' },
  ];
  return [
    { id: 'ch1', veil: true, card: 'goblin-grunt', steps: tour, setup: () => base([], ['goblin-grunt'], 3) },
    { id: 'ch2', veil: true, card: 'goblin-grunt', steps: cardSteps, setup: () => base([], ['goblin-grunt'], 3) },
    { id: 'ch3', veil: true, card: 'goblin-scrapper', steps: unitSteps, setup: () => ({ ...base([P('goblin-scrapper', 5, 5), O('shield-cadet', 4, 7)], [], 0), _action: true }) },
    { id: 'drag', veil: false, card: 'goblin-grunt', steps: dragSteps, setup: () => ({ ...base([P('goblin-grunt', 7, 4), O('dwarf-pickman', DRAG_FOE.row, DRAG_FOE.col)], [], 0), _action: true }) }, // the back row: the walk area stays short, so the bubble fits clear of it on a phone
    { id: 'ch4', veil: false, card: 'goblin-grunt', steps: battle,
      setup: () => ({ ...base([O('dwarf-pickman', 4, 7, { hp: 2 })], ['goblin-grunt'], 3, { playerDeck: ['goblin-scrounger', ...many('goblin-grunt', 5)], opponentHealth: 2 }) }) },
    { id: 'ch5', veil: false, card: 'goblin-scrapper', steps: [],
      setup: () => ({ ...base([O('shield-cadet', 3, 6), O('pebble-tosser', 2, 9)], ['goblin-scrounger', 'goblin-scrapper', 'goblin-slinger', 'venom-shiv'], 3,
        { playerBank: 2, playerDeck: many('goblin-grunt', 6), opponentDeck: many('shield-cadet', 6), opponentHealth: 5 }) }) },
  ];
}

// ---------------------------------------------------------------- the runner
export class Tutorial2 {
  app: any;
  ch = 0; s = 0;
  active = false;
  mode: 'card' | 'step' | 'end' = 'card';
  flags: Record<string, any> = {};
  fast: boolean;
  private layer: El | null = null;
  private raf = 0;
  private timers: any[] = [];
  private tapped = false;
  private idleMs = 0;
  private lastTick = 0;
  private stepKey = '';
  private listener: ((e: Event) => void) | null = null;
  private lastBox: Box | null = null;
  private chs = chapters();
  /** chapter 5: the goals ticked so far */
  goals = new Set<string>();
  constructor(app: any) { this.app = app; this.fast = !!app.test; }

  get chapter() { return this.chs[this.ch]; }
  get step(): Step | null { return this.mode === 'step' ? this.chapter?.steps[this.s] || null : null; }
  private text(id: string) { const c = V2.chapters.find((x: any) => x.id === this.chapter?.id); return (c?.steps || []).find((x: any) => x.id === id) || {}; }
  later(ms: number, f: () => void) { this.timers.push(setTimeout(f, ms)); }

  /** start (a chapter id 'ch1'..'ch6', or the whole tutorial from chapter 1) */
  begin(at?: string) {
    this.stopAll();
    const k = at ? this.chs.findIndex((c) => c.id === at) : 0;
    if (at === 'ch6') { this.toTricks(); return null; }
    this.ch = k >= 0 ? k : 0;
    this.active = true;
    this.goals.clear();
    this.mount();
    return this.startChapter();
  }
  startChapter() {
    const C = this.chapter;
    this.s = 0; this.mode = 'card'; this.flags = {}; this.stepKey = '';
    this.app.tut = null; // the old lesson runner stays out of a v2 board
    const opts = C.setup(this);
    const st = this.app.startTutorialLesson(opts);
    const s0 = this.app.game.state;
    // `hp`: a unit's Health in this lesson (ch4: the dwarf "on 2")
    for (const b of ((opts as any)._board || []) as any[]) if (b.hp) { const c = s0.board.creatures.find((x: any) => x.row === b.row && x.col === b.col); if (c) { c.health = Math.min(b.hp, c.maxHealth); c.maxHealth = c.health; } } // max too: units heal at their turn's start
    if ((opts as any)._action) this.app.game.act({ type: 'done' });
    this.app.game.scriptedEnemy = (s: any) => this.enemyAction(s);
    if (C.id === 'ch1') this.app.startEmotes?.();
    this.app.update?.(this.app.game.state, []);
    this.refresh();
    return st;
  }

  // ---------------------------------------------------------------- the enemy (only chapters 4 and 5 move; everything else passes)
  enemyAction(s: any): any | null {
    if (s.pendingResponse) return null;
    if (s.phase !== 'action' || s.activePlayer !== 'opponent') return null;
    const id = this.chapter?.id;
    if (id === 'ch4') {
      // one harmless step: the dwarf walks to (4,6) on the first enemy turn
      if (this.flags.enemyStepped) return null;
      const d = s.board.creatures.find((c: any) => c.owner === 'opponent');
      if (d && d.row === 4 && d.col === 7 && !s.board.creatures.some((c: any) => c.row === 4 && c.col === 6)) { this.flags.enemyStepped = true; return { type: 'move', creatureUid: d.uid, row: 4, col: 6 }; }
      this.flags.enemyStepped = true;
      return null;
    }
    if (id === 'ch5') return this.skirmishEnemy(s);
    return null;
  }

  // ---------------------------------------------------------------- the layer: veil, rings, finger, bubble, top bar
  mount() {
    this.unmount();
    const l = document.createElement('div');
    l.className = 'tut2-layer'; l.setAttribute('data-testid', 'tut2-layer');
    document.body.append(l);
    this.layer = l;
    this.listener = (e: Event) => this.onPress(e as PointerEvent);
    document.addEventListener('pointerdown', this.listener, true);
    document.addEventListener('click', this.listener, true);
    document.addEventListener('keydown', this.onKey, true);
    this.lastTick = performance.now();
    const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  unmount() {
    cancelAnimationFrame(this.raf); this.raf = 0;
    if (this.listener) { document.removeEventListener('pointerdown', this.listener, true); document.removeEventListener('click', this.listener, true); this.listener = null; }
    document.removeEventListener('keydown', this.onKey, true);
    this.layer?.remove(); this.layer = null;
    document.querySelectorAll('.tut2-layer').forEach((x) => x.remove());
  }
  stopAll() { for (const t of this.timers) clearTimeout(t); this.timers = []; this.unmount(); }
  stop() { this.stopAll(); this.active = false; if (this.app.game) this.app.game.scriptedEnemy = null; }

  private onKey = (e: KeyboardEvent) => {
    if (!this.active || !this.layer) return;
    if ((e.key === 'Enter' || e.key === ' ') && (this.mode === 'card' || this.step?.advance === 'ok')) {
      const b = this.layer.querySelector('[data-testid=tut-ok], [data-testid=tut-go]') as HTMLButtonElement | null;
      if (b) { e.preventDefault(); e.stopPropagation(); b.click(); }
    }
  };
  /** a press anywhere restarts the idle clock; a click-target step goes on when its target was pressed (the press still reaches it) */
  onPress(e: PointerEvent) {
    if (!this.active) return;
    this.idleMs = 0;
    const stp = this.step;
    if (!stp || stp.advance !== 'target' || this.tapped) return;
    if (this.layer?.contains(e.target as Node)) return;
    const r = rectOf(stp.target?.(this, this.app.game.state) || null);
    if (!r) return;
    if (e.clientX >= r.x - 6 && e.clientX <= r.x + r.w + 6 && e.clientY >= r.y - 6 && e.clientY <= r.y + r.h + 6) { this.tapped = true; this.later(this.fast ? 40 : 120, () => this.refresh()); }
  }

  /** every frame: steps that are done go on; the finger, ring, veil and bubble follow the target */
  frame() {
    const st = this.app.game?.state;
    if (!this.active || !st) return;
    if (!st.tutorial) { this.stop(); return; }
    const now = performance.now(); this.idleMs += now - this.lastTick; this.lastTick = now;
    if (this.chapter?.id === 'ch5' && this.mode === 'step') { this.skirmishTick(st); this.draw(st); return; }
    this.check(st);
    this.draw(st);
  }
  refresh() { const st = this.app.game?.state; if (st) { this.check(st); this.draw(st); } }
  private reopenAt = 0;
  check(st: any) {
    const stp = this.step;
    if (!stp) return;
    // chapter 2: closing the card view during 2.2-2.10 opens it again on the same step
    if (this.chapter.id === 'ch2' && stp.id !== 'card-open' && stp.id !== 'card-play' && !T.cardView() && performance.now() > this.reopenAt) { this.reopenAt = performance.now() + 600; this.keepCardOpen(); }
    let ok = false;
    if (stp.advance === 'target') ok = this.tapped && (!stp.goal || stp.goal(this, st));
    else if (stp.advance === 'goal') ok = !!stp.goal?.(this, st);
    if (stp.advance === 'target' && !ok && !this.tapped && stp.goal && stp.goal(this, st) && stp.id !== 'tour-menu-close') ok = true; // done another way (e.g. the keyboard)
    if (ok) this.next();
  }
  next() {
    this.tapped = false; this.idleMs = 0; this.stepKey = '';
    this.s++;
    const C = this.chapter;
    if (this.s >= C.steps.length) { this.endChapter(); return; }
    const stp = this.step!;
    stp.enter?.(this, this.app.game.state);
  }
  endChapter() {
    markTutorialDone(this.app.game.state);
    if (this.chapter.id === 'ch3') { try { localStorage.setItem('oreheart.tutorialSeen', '1'); } catch { /* storage off */ } }
    if (this.ch + 1 < this.chs.length) { this.ch++; this.startChapter(); }
    else this.toTricks();
  }

  // ---------------------------------------------------------------- squares and helpers
  square(c: Cell | null | undefined): Box | null {
    if (!c) return null;
    const qd = this.app.squareQuad?.(c.row, c.col);
    if (qd && qd.length >= 4) { const xs = qd.map((p: any) => p.x), ys = qd.map((p: any) => p.y); const x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
    const p = this.app.squareToScreen?.(c.row, c.col);
    return p ? { x: p.x - 20, y: p.y - 14, w: 40, h: 28 } : null;
  }
  gift(n: number) { const p = this.app.game.state?.players?.player; if (p && (p.crystals || 0) < n) { p.crystals = n; this.app.update?.(this.app.game.state, []); } }
  /** chapter 2: closing the card view during 2.2-2.10 opens it again on the same step */
  keepCardOpen() {
    if (T.cardView()) return;
    const hc = T.handCard(this, 'goblin-grunt');
    if (hc) (hc as El).click();
  }
  watchEmote() {
    this.flags.emoted = false;
    const m = this.app.emoteMod;
    const before = (this.app.emoteMod?.shownLog || []).length;
    const check = () => {
      if (!this.active) return;
      // Nov 11 (Ken: "you click the emote saying hello ... and it doesn't continue"): read the module's own log. The old line asked
      // emoteHooks(), which is null outside test pages, and `.shown` on null threw, so the watch stopped for good on the real site.
      let sent = false;
      try { const mm = this.app.emoteMod || m; const log = (mm && mm.shownLog) || []; sent = log.slice(before).some((x: any) => x && x.from === 'me'); } catch { sent = false; }
      if (sent || q('[data-testid=emote-pop][data-from=me]')) {
        this.flags.emoted = true;
        this.later(this.fast ? 50 : 900, () => { try { m?.pop?.('them', 'free-starter/hello'); } catch { /* no emotes */ } });
        return;
      }
      this.later(150, check);
    };
    check();
  }
  /** {click}, card numbers and ability words */
  words(s: string, cardId?: string): string {
    const c: any = cardId ? (CARDS as any)[cardId] : null;
    const ab = c?.abilities?.includes('bowl') ? 'bowl' : '';
    const t = coarse() ? 'tap' : 'click';
    return String(s || '')
      .replace(/\{Click\}/g, t[0].toUpperCase() + t.slice(1)).replace(/\{click\}/g, t)
      .replace(/\{name\}/g, c?.name || '').replace(/\{cost\}/g, String(c ? (() => { try { return c.type === 'creature' && this.app.game.state ? creatureCost(this.app.game.state, 'player', c) : c.cost; } catch { return c.cost; } })() : '')).replace(/\{atk\}/g, String(c?.attack ?? ''))
      .replace(/\{hp\}/g, String(c?.health ?? '')).replace(/\{move\}/g, String(c?.move ?? ''))
      .replace(/\{abCost\}/g, String(ab ? ABILITY_COST[ab] ?? 2 : 2)).replace(/\{abName\}/g, ab ? 'Strike' : '');
  }

  // ---------------------------------------------------------------- drawing
  draw(st: any) {
    const l = this.layer;
    if (!l) return;
    if (this.mode === 'card') { this.drawCard(); return; }
    if (this.mode === 'end') return;
    if (this.chapter.id === 'ch5') { this.drawGoals(st); return; }
    const stp = this.step;
    if (!stp) return;
    const tx = this.text(stp.id);
    const idle = this.idleMs >= 10000 && !!tx.hint;
    const key = `${this.ch}|${this.s}|${idle ? 'i' : ''}|${this.idleMs >= 25000 ? 'p' : ''}`;
    let tgt = rectOf(stp.target?.(this, st) || null);
    if (!tgt && stp.target && this.lastBox && this.stepKey.startsWith(`${this.ch}|${this.s}|`)) tgt = this.lastBox;
    if (tgt) this.lastBox = tgt;
    if (key !== this.stepKey) { this.stepKey = key; this.buildStep(stp, tx, idle); }
    this.position(stp, tgt, st);
  }
  private bar(): El {
    const C = V2.chapters[this.ch] || {};
    const of = this.chapter?.steps.length || 0;
    const t = String(V2.bar || '').replace('{ch}', String(this.ch + 1)).replace('{total}', String(this.chs.length + 1)).replace('{n}', String(Math.min(this.s + 1, of || 1))).replace('{of}', String(of || 1));
    const b = document.createElement('div'); b.className = 'tut2-bar'; b.setAttribute('data-testid', 'tut2-bar');
    const sp = document.createElement('span'); sp.textContent = `${C.title || ''} · ${t}`;
    b.append(sp, this.button('End tutorial', 'tut2-skipbar', () => this.askSkip(), { 'data-testid': 'tut-skip-bar' }));
    return b;
  }
  button(label: string, cls: string, on: () => void, attrs: Record<string, string> = {}) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label;
    for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
    b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); on(); });
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    return b;
  }
  buildStep(stp: Step, tx: any, idle: boolean) {
    const l = this.layer!;
    l.replaceChildren();
    const veilOn = stp.veil ?? this.chapter.veil;
    if (veilOn && stp.target) for (let i = 0; i < 4; i++) { const v = document.createElement('div'); v.className = 'tut2-veil'; v.dataset.side = String(i); l.append(v); }
    const ring = document.createElement('div'); ring.className = 'tut2-ring' + (stp.tight ? ' tight' : '') + (this.idleMs >= 25000 ? ' grow' : ''); ring.setAttribute('data-testid', 'tut-ring');
    const extra = (stp.rings?.(this, this.app.game.state) || []).map(() => { const r = document.createElement('div'); r.className = 'tut2-ring extra'; return r; });
    const finger = document.createElement('img'); finger.className = 'tut2-finger'; finger.src = PIC('hand-pointing'); finger.alt = ''; finger.draggable = false; finger.setAttribute('data-testid', 'tut-finger');
    const bub = document.createElement('div'); bub.className = 'tut2-bubble' + (idle ? ' idle' : '') + (this.idleMs >= 25000 ? ' pulse' : '');
    bub.setAttribute('role', 'dialog'); bub.setAttribute('aria-live', 'polite'); bub.setAttribute('data-testid', 'tut-bubble');
    bub.dataset.step = stp.id; bub.dataset.advance = stp.advance === 'target' ? 'click-target' : stp.advance; bub.dataset.target = stp.id;
    const title = document.createElement('b'); title.className = 'tut2-title'; title.textContent = this.words(tx.title || '', stp.card || this.chapter.card);
    const line = document.createElement('p'); line.className = 'tut2-do'; line.textContent = this.words(idle ? tx.hint : tx.do || '', stp.card || this.chapter.card);
    const row = document.createElement('div'); row.className = 'tut2-row';
    if (stp.advance === 'ok') row.append(this.button(tx.ok || 'OK', 'primary tut2-ok', () => this.okPressed(), { 'data-testid': 'tut-ok' }));
    row.append(this.button('Skip', 'tut2-skipstep', () => this.skipStep(), { 'data-testid': 'tut-skip' })); // Ken, Nov 11: "skip this ... to the next tutorial item"
    row.append(this.button('End tutorial', 'tut2-end', () => this.askSkip(), { 'data-testid': 'tut-end' }));
    bub.append(title, line);
    if (stp.id === 'dice') bub.append(this.swingKey());
    bub.append(row);
    if (stp.target) l.append(ring, ...extra, finger);
    l.append(bub, this.bar());
    if (stp.drag) { const g = document.createElement('div'); g.className = 'tut2-ghost'; l.append(g); }
    if (stp.advance === 'ok') (row.querySelector('.tut2-ok') as El | null)?.focus?.({ preventScroll: true });
  }
  okPressed() { const stp = this.step; if (stp && stp.advance === 'ok') this.next(); this.refresh(); }
  /** Ken, Nov 11: "Skip ... which will skip it to the next tutorial item". In the first battle the step is played for you first (a few
   *  actions), so the next step finds the board it expects; elsewhere it simply goes on. */
  skipStep() {
    const stp = this.step;
    if (!stp) return;
    const st0 = this.app.game.state;
    if ((this.chapter.id === 'ch4' || this.chapter.id === 'drag') && st0) {
      for (let i = 0; i < 6; i++) {
        const st = this.app.game.state;
        if (stp.goal && stp.goal(this, st)) break;
        const a = this.autoAction();
        if (!a) break;
        const r = this.app.game.act(a);
        if (!r || !r.ok) break;
      }
    }
    if (stp.id === 'tour-emote' || stp.id === 'tour-emote-send') { try { this.app.emoteMod?.closeDial?.(); } catch { /* none */ } document.querySelector('.emote-dial')?.remove(); }
    if (stp.id === 'tour-menu-panel' || stp.id === 'tour-menu') { this.app.menuPinned = false; this.app.menuOpen?.(false); }
    this.next();
    this.refresh();
  }
  /** the chapter card's Skip: on to the next part */
  skipChapter() { this.mode = 'step'; this.s = this.chapter.steps.length; this.endChapter(); }
  swingKey(): El {
    const w = document.createElement('div'); w.className = 'tut-swings tut2-swings';
    for (const [pic, word, odds] of [['swing-hit', 'HIT', '8 in 10'], ['swing-miss', 'MISS', '1 in 10'], ['block', 'BLOCK', '1 in 10']]) {
      const f = document.createElement('figure'); f.className = 'tut-swing ' + word.toLowerCase();
      const i = document.createElement('img'); i.className = 'tut-pic'; i.src = PIC(pic); i.alt = word; i.draggable = false;
      const c = document.createElement('figcaption'); c.innerHTML = `<b>${word}</b><span class="tut-odds">${odds}</span>`;
      f.append(i, c); w.append(f);
    }
    return w;
  }
  /** place the bubble beside the finger, the fingertip on the target, the veil around it */
  position(stp: Step, tgt: Box | null, st: any) {
    const l = this.layer!;
    const bub = l.querySelector('.tut2-bubble') as El | null;
    if (!bub) return;
    const W = innerWidth, H = innerHeight, M = 12;
    const bw = bub.offsetWidth, bh = bub.offsetHeight;
    const veils = l.querySelectorAll('.tut2-veil') as NodeListOf<El>;
    const ring = l.querySelector('.tut2-ring:not(.extra)') as El | null, finger = l.querySelector('.tut2-finger') as El | null;
    if (!tgt || stp.place === 'centre') {
      bub.style.left = `${Math.round((W - bw) / 2)}px`; bub.style.top = `${Math.round((H - bh) / 2)}px`; bub.dataset.side = 'centre';
      if (ring) ring.style.display = 'none'; if (finger) finger.style.display = 'none';
      veils.forEach((v, i) => { v.style.cssText = i === 0 ? 'left:0;top:0;width:100vw;height:100vh' : 'display:none'; });
      return;
    }
    // the target is off screen (the camera moved, the hand scrolled): an arrow at the edge points toward it, the bubble says "look here"
    const off = tgt.x + tgt.w < 0 || tgt.y + tgt.h < 0 || tgt.x > W || tgt.y > H;
    let arrow = l.querySelector('.tut2-edge') as El | null;
    if (off) {
      if (!arrow) { arrow = document.createElement('div'); arrow.className = 'tut2-edge'; arrow.setAttribute('data-testid', 'tut-edge'); arrow.textContent = '\u27a4'; l.append(arrow); }
      const cx = Math.max(28, Math.min(W - 28, tgt.x + tgt.w / 2)), cy = Math.max(28, Math.min(H - 28, tgt.y + tgt.h / 2));
      const ang = Math.atan2(tgt.y + tgt.h / 2 - H / 2, tgt.x + tgt.w / 2 - W / 2) * 180 / Math.PI;
      arrow.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) rotate(${ang}deg)`;
      if (ring) ring.style.display = 'none'; if (finger) finger.style.display = 'none';
      veils.forEach((v, i) => { v.style.cssText = i === 0 ? 'left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,.35)' : 'display:none'; });
      bub.style.left = `${Math.round(Math.max(M, Math.min(W - M - bw, cx - bw / 2)))}px`; bub.style.top = `${Math.round(Math.max(M, Math.min(H - M - bh, cy < H / 2 ? cy + 40 : cy - 40 - bh)))}px`;
      bub.dataset.side = 'edge';
      return;
    }
    arrow?.remove();
    const pad = stp.tight ? 4 : 8;
    const R = { x: tgt.x - pad, y: tgt.y - pad, w: tgt.w + pad * 2, h: tgt.h + pad * 2 };
    if (ring) { ring.style.display = ''; Object.assign(ring.style, { left: `${R.x}px`, top: `${R.y}px`, width: `${R.w}px`, height: `${R.h}px` }); }
    const extras = [...l.querySelectorAll('.tut2-ring.extra')] as El[];
    const er = stp.rings?.(this, st) || [];
    extras.forEach((e, i) => { const b = rectOf(er[i] || null); if (!b) { e.style.display = 'none'; return; } e.style.display = ''; Object.assign(e.style, { left: `${b.x - 6}px`, top: `${b.y - 6}px`, width: `${b.w + 12}px`, height: `${b.h + 12}px` }); });
    // the veil: four panels around the hole (the hole lets presses through to the target only)
    if (veils.length === 4) {
      const [a, b, c, d] = [...veils];
      a.style.cssText = `left:0;top:0;width:100vw;height:${Math.max(0, R.y)}px`;
      b.style.cssText = `left:0;top:${R.y + R.h}px;width:100vw;height:${Math.max(0, H - R.y - R.h)}px`;
      c.style.cssText = `left:0;top:${R.y}px;width:${Math.max(0, R.x)}px;height:${R.h}px`;
      d.style.cssText = `left:${R.x + R.w}px;top:${R.y}px;width:${Math.max(0, W - R.x - R.w)}px;height:${R.h}px`;
    }
    // the side: PC follows the step's wish, then its opposite, then the other two; phones only above / below
    const F = Math.round(Math.max(44, Math.min(84, H * 0.075)));
    const want = phone() ? (stp.placePhone || 'above') : (stp.place || 'above');
    const opp: Record<string, Place> = { above: 'below', below: 'above', left: 'right', right: 'left' };
    let order: Place[] = phone() ? [want, opp[want]] : [want, opp[want], ...(['above', 'below', 'left', 'right'] as Place[]).filter((p) => p !== want && p !== opp[want])];
    if (phone()) order = order.filter((p) => p === 'above' || p === 'below');
    // Nov 11: squares a step marks (where a unit can walk) stay uncovered too: the bubble tries beside the target, then beside them all
    const marks = (stp.rings?.(this, st) || []).map((x) => rectOf(x)).filter(Boolean) as Box[];
    const U = marks.reduce((u, b) => { const x0 = Math.min(u.x, b.x), y0 = Math.min(u.y, b.y); return { x: x0, y: y0, w: Math.max(u.x + u.w, b.x + b.w) - x0, h: Math.max(u.y + u.h, b.y + b.h) - y0 }; }, R);
    const ovl = (x: number, y: number, b: Box) => !(x + bw <= b.x || x >= b.x + b.w || y + bh <= b.y || y >= b.y + b.h);
    const spotAt = (side: Place, A: Box) => {
      const cx = A.x + A.w / 2, cy = A.y + A.h / 2;
      let x = 0, y = 0;
      if (side === 'above') { x = cx - bw / 2; y = A.y - F - bh; }
      else if (side === 'below') { x = cx - bw / 2; y = A.y + A.h + F; }
      else if (side === 'left') { x = A.x - F - bw; y = cy - bh / 2; }
      else { x = A.x + A.w + F; y = cy - bh / 2; }
      if (side === 'above' || side === 'below') x = Math.max(M, Math.min(W - M - bw, x)); else y = Math.max(M, Math.min(H - M - bh, y));
      const fits = x >= M - 0.5 && y >= M - 0.5 && x + bw <= W - M + 0.5 && y + bh <= H - M + 0.5;
      return { x, y, ok: fits && !ovl(x, y, R) && !marks.some((m) => ovl(x, y, m)) };
    };
    const spot = (side: Place) => {
      const a = spotAt(side, R);
      if (a.ok || !marks.length) return a;
      const b = spotAt(side, U);
      if (b.ok) return b;
      // no room clear of every mark on this side: at least keep the target and as many marks as possible uncovered
      const fitsA = a.x >= M - 0.5 && a.y >= M - 0.5 && a.x + bw <= W - M + 0.5 && a.y + bh <= H - M + 0.5 && !ovl(a.x, a.y, R);
      return { ...a, ok: false, soft: fitsA ? marks.filter((m) => ovl(a.x, a.y, m)).length : 999 } as any;
    };
    const spotOld = (side: Place) => {
      const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      let x = 0, y = 0;
      if (side === 'above') { x = cx - bw / 2; y = R.y - F - bh; }
      else if (side === 'below') { x = cx - bw / 2; y = R.y + R.h + F; }
      else if (side === 'left') { x = R.x - F - bw; y = cy - bh / 2; }
      else { x = R.x + R.w + F; y = cy - bh / 2; }
      // slide along the side to stay on screen
      if (side === 'above' || side === 'below') x = Math.max(M, Math.min(W - M - bw, x)); else y = Math.max(M, Math.min(H - M - bh, y));
      const fits = x >= M - 0.5 && y >= M - 0.5 && x + bw <= W - M + 0.5 && y + bh <= H - M + 0.5;
      const hits = !(x + bw <= R.x || x >= R.x + R.w || y + bh <= R.y || y >= R.y + R.h);
      return { x, y, ok: fits && !hits };
    };
    void spotOld;
    let side: Place = order[0], at = spot(side);
    let found = false;
    for (const sd of order) { const p = spot(sd); if (p.ok) { side = sd; at = p; found = true; break; } }
    if (!found && marks.length) { // the side that covers the fewest marks (never the target)
      let best = 1e9;
      for (const sd of (['above', 'below', 'left', 'right'] as Place[]).filter((x) => !phone() || x === 'above' || x === 'below')) { const p: any = spot(sd); if (p.soft < best) { best = p.soft; side = sd; at = { x: p.x, y: p.y, ok: true }; } }
    }
    if (!at.ok) { // nothing fits fully: the side with the most room, kept on screen
      const room: Record<string, number> = { above: R.y, below: H - R.y - R.h, left: R.x, right: W - R.x - R.w };
      side = order.slice().sort((a, b) => room[b] - room[a])[0]; at = spot(side);
      at.x = Math.max(M, Math.min(W - M - bw, at.x)); at.y = Math.max(M, Math.min(H - M - bh, at.y));
    }
    // the bubble holds still unless the target really moved (units bob while idle; a jittering bubble is hard to read and to press)
    const prev = (bub as any)._at as { x: number; y: number; side: string } | undefined;
    if (!prev || prev.side !== side || Math.abs(prev.x - at.x) > 10 || Math.abs(prev.y - at.y) > 10) { (bub as any)._at = { x: at.x, y: at.y, side }; bub.style.left = `${Math.round(at.x)}px`; bub.style.top = `${Math.round(at.y)}px`; }
    bub.dataset.side = side;
    // the finger: from the bubble's side, its tip just inside the target's edge (Brush's tip sits at 44 % / 86 % of the picture)
    if (finger) {
      finger.style.display = '';
      const inset = Math.min(10, Math.max(3, Math.min(tgt.w, tgt.h) / 3));
      const cx = tgt.x + tgt.w / 2, cy = tgt.y + tgt.h / 2;
      const tip = side === 'above' ? { x: cx, y: tgt.y + inset } : side === 'below' ? { x: cx, y: tgt.y + tgt.h - inset } : side === 'left' ? { x: tgt.x + inset, y: cy } : { x: tgt.x + tgt.w - inset, y: cy };
      const rot = side === 'above' ? 0 : side === 'below' ? 180 : side === 'left' ? -90 : 90;
      finger.style.height = `${F}px`;
      const drag = stp.drag?.(this, st);
      const from = drag ? rectOf(drag.from) : null;
      if (from && !this.fast) {
        // the real drag, start to end, carried by the finger (and a ghost card)
        const f0 = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const k = (performance.now() % 2400) / 2400, e = k < 0.15 ? 0 : k > 0.75 ? 1 : (k - 0.15) / 0.6;
        const p = { x: f0.x + (tip.x - f0.x) * e, y: f0.y + (tip.y - f0.y) * e };
        finger.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${rot}deg) translate(-44%, -86%)`;
        const g = l.querySelector('.tut2-ghost') as El | null;
        if (g) { g.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`; g.style.opacity = k > 0.12 && k < 0.82 ? '0.85' : '0'; }
      } else finger.style.transform = `translate(${tip.x}px, ${tip.y}px) rotate(${rot}deg) translate(-44%, -86%)`;
      (finger as any)._tip = tip;
    }
  }

  // ---------------------------------------------------------------- the chapter card, skip, the picker, the end
  drawCard() {
    const l = this.layer!;
    const C = V2.chapters[this.ch] || {};
    const key = `card|${this.ch}`;
    if (this.stepKey === key) return;
    this.stepKey = key;
    l.replaceChildren();
    const v = document.createElement('div'); v.className = 'tut2-veil full'; v.style.cssText = 'left:0;top:0;width:100vw;height:100vh';
    const card = document.createElement('div'); card.className = 'tut-card tut2-card'; card.setAttribute('role', 'dialog'); card.setAttribute('data-testid', 'tut2-card'); card.dataset.chapter = C.id;
    const dots = document.createElement('div'); dots.className = 'tut-dots';
    for (let i = 0; i < this.chs.length + 1; i++) { const d = document.createElement('i'); d.className = i < this.ch ? 'done' : i === this.ch ? 'now' : ''; dots.append(d); }
    const img = document.createElement('img'); img.className = 'tut-pic tut-big-pic'; img.src = PIC(C.pic || 'hand-pointing'); img.alt = ''; img.draggable = false;
    const say = document.createElement('p'); say.className = 'tut-say'; say.textContent = C.say || '';
    const sub = document.createElement('p'); sub.className = 'tut-sub'; sub.textContent = C.sub || '';
    const row = document.createElement('div'); row.className = 'tut-row';
    row.append(this.button('Try it!', 'primary tut-go', () => { this.mode = 'step'; this.stepKey = ''; this.idleMs = 0; this.step?.enter?.(this, this.app.game.state); this.refresh(); }, { 'data-testid': 'tut-go' }),
      this.button('Skip', 'tut-skip tut2-skippart', () => this.skipChapter(), { 'data-testid': 'tut-skip-part', title: 'Skip this part' }),
      this.button('End tutorial', 'tut-skip tut2-end', () => this.askSkip(), { 'data-testid': 'tut-end' }));
    card.append(dots, img, say, sub, row);
    l.append(v, card);
    (row.querySelector('.tut-go') as El | null)?.focus?.({ preventScroll: true });
  }
  askSkip() {
    const l = this.layer;
    if (!l || l.querySelector('.tut2-ask')) return;
    const S = V2.skip || {};
    const box = document.createElement('div'); box.className = 'tut2-ask tut-card'; box.setAttribute('role', 'alertdialog'); box.setAttribute('data-testid', 'tut-skip-ask');
    const p = document.createElement('p'); p.className = 'tut-say'; p.textContent = S.ask || 'Skip the tutorial?';
    const row = document.createElement('div'); row.className = 'tut-row';
    row.append(this.button(S.yes || 'Yes, skip', 'primary', () => this.skipNow(), { 'data-testid': 'tut-skip-yes' }), this.button(S.no || 'Keep learning', '', () => box.remove(), { 'data-testid': 'tut-skip-no' }));
    box.append(p, row);
    l.append(box);
  }
  /** back to where the tutorial was started: the Dashboard online, the front menu offline (showMenu picks) */
  skipNow() {
    try { localStorage.setItem('oreheart.tutorialSeen', '1'); } catch { /* storage off */ }
    this.stop();
    this.app.tut?.stop?.(); this.app.tut = null;
    if (this.app.tutorialFrom === 'settings' && this.app.showSettings) this.app.showSettings(); else this.app.showMenu();
  }
  /** chapter 6: today's clever-trick lessons (orders, chase, chain, archers, mining orders, guard arrows, swap) */
  toTricks() {
    this.stop();
    this.app.lastTutorial = true;
    this.app.beginLegacyTutorial?.('order');
  }
  /** the Dashboard / menu picker: the whole tutorial or one part */
  static picker(app: any, from: string) {
    document.querySelectorAll('.tut2-picker').forEach((x) => x.remove());
    const P0 = V2.picker || {};
    const wrap = document.createElement('div'); wrap.className = 'tut2-layer tut2-picker'; wrap.setAttribute('data-testid', 'tut-picker');
    const v = document.createElement('div'); v.className = 'tut2-veil full'; v.style.cssText = 'left:0;top:0;width:100vw;height:100vh';
    const card = document.createElement('div'); card.className = 'tut-card tut2-card'; card.setAttribute('role', 'dialog');
    const say = document.createElement('p'); say.className = 'tut-say'; say.textContent = P0.title || 'Tutorial';
    const sub = document.createElement('p'); sub.className = 'tut-sub'; sub.textContent = P0.do || '';
    const list = document.createElement('div'); list.className = 'tut2-pick';
    const go = (at?: string) => { wrap.remove(); app.tutorialFrom = from; app.beginTutorial(at || 'ch1'); };
    const mk = (label: string, at: string | undefined, cls = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label; b.setAttribute('data-testid', 'tut-pick-' + (at || 'all')); b.addEventListener('click', () => go(at)); return b; };
    list.append(mk(P0.whole || 'Whole tutorial', undefined, 'primary'), ...V2.chapters.map((c: any) => mk(c.title, c.id)));
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn tut-skip'; close.textContent = 'Close'; close.addEventListener('click', () => wrap.remove());
    card.append(say, sub, list, close);
    wrap.append(v, card);
    document.body.append(wrap);
  }
  /** a tutorial board was won (chapters 4 and 5): the "runs away" scene plays, then the next part */
  onWin(_st: any) {
    if (this.chapter?.id === 'ch4') {
      const at = this.chapter.steps.findIndex((x) => x.id === 'win');
      if (at >= 0 && this.s < at) { this.s = at; this.stepKey = ''; this.mode = 'step'; }
      return true;
    }
    if (this.chapter?.id === 'ch5') { this.later(this.fast ? 50 : 2200, () => this.skirmishEnd()); return true; }
    return false;
  }

  // ---------------------------------------------------------------- chapter 5: the practice skirmish (a goal list, light help)
  /** the player's own round (the engine counts both sides' turns; the player moves first) */
  round(st: any) { return Math.max(1, Math.ceil((st?.turn || 1) / 2)); }
  private goalDone(id: string, st: any): boolean {
    const mine = st.board.creatures.filter((c: any) => c.owner === 'player');
    const by = (k: string) => mine.find((c: any) => c.cardId === k);
    const near = (c: any, m: any) => c && Math.max(Math.abs(c.row - m.row), Math.abs(c.col - m.col)) <= 1;
    const S = st.stats || {};
    switch (id) {
      case 'g-miner': return !!by('goblin-scrounger') || !!this.flags['seen:goblin-scrounger'];
      case 'g-brawler': return !!by('goblin-scrapper') || !!this.flags['seen:goblin-scrapper'];
      case 'g-walk-miner': { const m = by('goblin-scrounger'); return (!!m && (st.sites.some((s: any) => near(m, s)) || !!this.flags.minerWalked)) || this.goals.has('g-dig'); }
      case 'g-end-1': return st.turn > 1;
      case 'g-dig': return (S.mined?.player || 0) > 0 || !!this.flags.dug;
      case 'g-slinger': return !!by('goblin-slinger') || !!this.flags['seen:goblin-slinger'];
      case 'g-walk-brawler': { const b = by('goblin-scrapper'); return (!!b && b.row < 7) || this.goals.has('g-attack'); }
      case 'g-attack': return !!this.flags.brawlerHit;
      case 'g-shoot': return !!this.flags.slingerShot;
      case 'g-spell': return !!this.flags.cast;
      case 'g-strike': return !!this.flags.struck;
      case 'g-hit-commander': return (st.players.opponent.health ?? 5) < 5;
      case 'g-win': return st.phase === 'over' && st.winner === 'player';
    }
    return false;
  }
  /** what the events said happened (attacks, spells, the ability, a dig, a walk) */
  noteEvents(events: any[]) {
    if (!this.active) return;
    if (this.chapter?.id === 'drag') { for (const e of events || []) if (e.type === 'attack' && this.app.game.state?.board.creatures.some((c: any) => c.uid === e.uid && c.owner === 'player')) this.flags.attacked = true; return; }
    if (this.chapter?.id !== 'ch5') return;
    const st = this.app.game.state;
    const kind = (uid: string) => st.board.creatures.find((c: any) => c.uid === uid)?.cardId || this.flags['u:' + uid];
    for (const e of events || []) {
      if (e.type === 'summon' && e.owner === 'player') { this.flags['u:' + e.uid] = e.cardId; this.flags['seen:' + e.cardId] = true; }
      if (e.type === 'attack') { const id = kind(e.uid); if (id === 'goblin-scrapper' && !e.target?.commander) this.flags.brawlerHit = true; if (id === 'goblin-slinger') this.flags.slingerShot = true; }
      if ((e.type === 'cast' && e.player === 'player') || (e.type === 'spell' && e.player === 'player')) this.flags.cast = true;
      if ((e.type === 'abilityUsed' && (e.ability === 'bowl' || e.ability === 'strike')) || e.type === 'bowl') this.flags.struck = true;
      if (e.type === 'mine' && kind(e.uid) === 'goblin-scrounger') this.flags.dug = true;
      if (e.type === 'move' && kind(e.uid) === 'goblin-scrounger') this.flags.minerWalked = true;
    }
  }
  private lastRound = 0;
  skirmishTick(st: any) {
    const G = (V2.chapters.find((c: any) => c.id === 'ch5')?.goals || []) as any[];
    for (const g of G) if (!this.goals.has(g.id) && this.goalDone(g.id, st)) { this.goals.add(g.id); this.idleMs = 0; }
    // the practice crystals: +2 at the start of rounds 2 and 3, so every goal is affordable (spec: Flow 3 + Bank 2, then gifts)
    const round = this.round(st);
    if (st.activePlayer === 'player' && st.phase === 'deploy' && round !== this.lastRound) {
      this.lastRound = round;
      if (round === 2 || round === 3) { const p = st.players.player; p.crystals = (p.crystals || 0) + 2; this.app.update?.(st, []); this.app.flash?.(V2.chapters.find((c: any) => c.id === 'ch5')?.gift || '+2 practice crystals'); }
    }
  }
  private currentGoal(st: any): any | null {
    const G = (V2.chapters.find((c: any) => c.id === 'ch5')?.goals || []) as any[];
    const r = this.round(st);
    return G.find((g) => !this.goals.has(g.id) && g.round <= r) || G.find((g) => !this.goals.has(g.id)) || null;
  }
  /** the near mine: two squares in front of the back row, so a Miner (1 foot) reaches it in one walk */
  private static MINE = MINES[2];
  private goalTarget(id: string, st: any): { to: Element | Box | null; from?: Element | Box | null } {
    const mine = (k: string) => st.board.creatures.find((c: any) => c.owner === 'player' && c.cardId === k);
    const foe = (k?: string) => st.board.creatures.find((c: any) => c.owner === 'opponent' && (!k || c.cardId === k));
    const M = Tutorial2.MINE;
    switch (id) {
      case 'g-miner': return { from: T.handCard(this, 'goblin-scrounger'), to: this.square({ row: 7, col: M.col - 1 }) };
      case 'g-brawler': return { from: T.handCard(this, 'goblin-scrapper'), to: this.square({ row: 7, col: 6 }) };
      case 'g-walk-miner': return st.phase === 'deploy' ? { to: T.done(this) } : { from: tokenOf(this, mine('goblin-scrounger')), to: this.square({ row: M.row + 1, col: M.col - 1 }) };
      case 'g-end-1': return { to: T.done(this) };
      case 'g-dig': return { from: tokenOf(this, mine('goblin-scrounger')), to: this.square(M) };
      case 'g-slinger': return { from: T.handCard(this, 'goblin-slinger'), to: this.square({ row: 7, col: 7 }) };
      case 'g-walk-brawler': { const c = foe('shield-cadet'); return { from: tokenOf(this, mine('goblin-scrapper')), to: c ? this.square({ row: Math.min(7, c.row + 1), col: c.col }) : null }; }
      case 'g-attack': { const c = foe('shield-cadet'); return { from: tokenOf(this, mine('goblin-scrapper')), to: c ? this.square(c) : null }; }
      case 'g-shoot': { const f = foe('pebble-tosser') || foe(); return { from: tokenOf(this, mine('goblin-slinger')), to: f ? this.square(f) : null }; }
      case 'g-spell': { const f = foe('pebble-tosser') || foe(); return { from: T.handCard(this, 'venom-shiv'), to: f ? this.square(f) : null }; }
      case 'g-strike': { const tk = tokenOf(this, mine('goblin-scrapper')); return { to: (tk?.querySelector('.ab-btn[data-ability=strike]') as El | null) || tk }; }
      case 'g-hit-commander': case 'g-win': return { to: this.square(ENEMY_SH) };
    }
    return { to: null };
  }
  drawGoals(st: any) {
    const l = this.layer!;
    const G = (V2.chapters.find((c: any) => c.id === 'ch5')?.goals || []) as any[];
    const cur = this.currentGoal(st);
    const idle = this.idleMs >= 10000;
    const round = this.round(st);
    const key = `g|${[...this.goals].join(',')}|${cur?.id}|${idle ? 'i' : ''}|${round}|${st.phase}`;
    if (key !== this.stepKey) {
      this.stepKey = key;
      l.replaceChildren();
      const bub = document.createElement('div'); bub.className = 'tut2-bubble tut2-goals' + (idle ? ' idle' : ''); bub.setAttribute('data-testid', 'tut-bubble'); bub.dataset.step = cur?.id || 'done'; bub.dataset.advance = 'goal';
      const title = document.createElement('b'); title.className = 'tut2-title'; title.textContent = `Round ${round}`;
      const ul = document.createElement('ul'); ul.className = 'tut2-list';
      // this round's goals, plus any earlier one still open; ticked ones stay (struck through) for the round
      for (const g of G.filter((x) => x.round === round || (x.round < round && !this.goals.has(x.id)))) {
        const li = document.createElement('li'); li.dataset.goal = g.id; li.className = this.goals.has(g.id) ? 'done' : g === cur ? 'now' : '';
        li.textContent = `${this.goals.has(g.id) ? '☑' : '☐'} ${this.words(g.line)}`; ul.append(li);
      }
      bub.append(title, ul);
      if (idle && cur) { const p = document.createElement('p'); p.className = 'tut2-do'; p.textContent = this.words(cur.hint); bub.append(p); }
      const row = document.createElement('div'); row.className = 'tut2-row';
      row.append(this.button('Skip', 'tut2-skipstep', () => { if (cur) { this.goals.add(cur.id); this.idleMs = 0; this.stepKey = ''; } }, { 'data-testid': 'tut-skip' }), this.button('End tutorial', 'tut2-end', () => this.askSkip(), { 'data-testid': 'tut-end' }));
      bub.append(row);
      l.append(bub, this.bar());
      if (idle && cur) { const f = document.createElement('img'); f.className = 'tut2-finger'; f.src = PIC('hand-pointing'); f.alt = ''; f.draggable = false; f.setAttribute('data-testid', 'tut-finger'); const r = document.createElement('div'); r.className = 'tut2-ring'; const gh = document.createElement('div'); gh.className = 'tut2-ghost'; l.append(r, f, gh); }
    }
    // the goal list sits at the left (clear of the board's middle); the finger plays the drag when the player is slow
    const bub = l.querySelector('.tut2-bubble') as El | null;
    if (bub) { bub.style.left = '12px'; bub.style.top = `${Math.round(Math.min(innerHeight * 0.16, 150))}px`; bub.dataset.side = 'corner'; }
    if (idle && cur) {
      const tg = this.goalTarget(cur.id, st);
      const fake: Step = { id: cur.id, advance: 'goal', target: () => tg.to, drag: tg.from ? () => ({ from: tg.from!, to: tg.to }) : undefined, place: 'above', placePhone: 'above' };
      const keep = bub ? { l: bub.style.left, t: bub.style.top } : null;
      this.position(fake, rectOf(tg.to), st);
      if (bub && keep) { bub.style.left = keep.l; bub.style.top = keep.t; }
    }
  }
  /** the enemy: the Cadet steps toward your nearest unit, the Pebble Tosser shoots one of your units at full Health (never the Miner,
   *  never your Commander); it never summons */
  skirmishEnemy(s: any): any | null {
    const acts: any[] = legalActions(s);
    const mine = s.board.creatures.filter((c: any) => c.owner === 'player');
    const tosser = s.board.creatures.find((c: any) => c.owner === 'opponent' && c.cardId === 'pebble-tosser' && !c.hasAttacked);
    if (tosser) { const a = acts.find((x: any) => x.type === 'attack' && x.creatureUid === tosser.uid && x.target && !x.target.commander && mine.some((m: any) => m.row === x.target.row && m.col === x.target.col && m.cardId !== 'goblin-scrounger' && m.health >= m.maxHealth)); if (a) return a; }
    const cadet = s.board.creatures.find((c: any) => c.owner === 'opponent' && c.cardId === 'shield-cadet' && !c.hasMoved && !c.hasAttacked);
    if (cadet && mine.length) {
      const d = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
      const near = mine.slice().sort((a: any, b: any) => d(a, cadet) - d(b, cadet))[0];
      if (d(near, cadet) > 1) {
        const mv = acts.filter((x: any) => x.type === 'move' && x.creatureUid === cadet.uid && Math.max(Math.abs(x.row - cadet.row), Math.abs(x.col - cadet.col)) === 1).sort((a: any, b: any) => d(a, near) - d(b, near))[0];
        if (mv && d(mv, near) < d(cadet, near)) return mv;
      }
    }
    return null;
  }
  skirmishEnd() {
    const l = this.layer;
    if (!l) return;
    this.mode = 'end';
    const E = V2.chapters.find((c: any) => c.id === 'ch5')?.end || {};
    l.replaceChildren();
    const v = document.createElement('div'); v.className = 'tut2-veil full'; v.style.cssText = 'left:0;top:0;width:100vw;height:100vh';
    const card = document.createElement('div'); card.className = 'tut-card tut2-card tut-final'; card.setAttribute('role', 'dialog'); card.setAttribute('data-testid', 'tut2-end');
    const img = document.createElement('img'); img.className = 'tut-pic tut-big-pic'; img.src = PIC('commander-retreat'); img.alt = ''; img.draggable = false;
    const say = document.createElement('p'); say.className = 'tut-say'; say.textContent = E.title || "That's a real match!";
    const sub = document.createElement('p'); sub.className = 'tut-sub'; sub.textContent = E.do || 'Ready for the real thing?';
    const row = document.createElement('div'); row.className = 'tut-row';
    row.append(this.button(E.play || 'Play now!', 'primary tut-go', () => { try { localStorage.setItem('oreheart.tutorialSeen', '1'); } catch { /* storage off */ } this.stop(); this.app.showMenu(); }, { 'data-testid': 'tut-play-now' }),
      this.button(E.more || 'Show me the clever tricks', 'tut-skip', () => this.toTricks(), { 'data-testid': 'tut-tricks' }));
    card.append(img, say, sub, row);
    l.append(v, card);
  }
  /** the checks' hook: a legal action toward the current goal (ch5) or the current step (ch4); null when nothing is due */
  autoAction(): any | null {
    const st = this.app.game.state;
    if (!st || !this.active || st.phase === 'over') return null;
    if (st.pendingResponse) return { type: 'pass' };
    if (st.priority !== 'player' || st.activePlayer !== 'player') return null;
    const legal: any[] = this.app.game.legalActions();
    if (this.chapter?.id === 'ch4') return this.battleAction(st, legal);
    if (this.chapter?.id === 'drag') {
      const g = st.board.creatures.find((c: any) => c.owner === 'player'), id = this.step?.id;
      if (!g) return null;
      if (id === 'drag-move') return legal.find((x: any) => x.type === 'move' && x.creatureUid === g.uid && x.row === 5 && x.col === 6) || null;
      if (id === 'drag-attack') return legal.find((x: any) => x.type === 'attack' && x.creatureUid === g.uid && x.target && !x.target.commander) || null;
      return null;
    }
    const me = (k: string) => st.board.creatures.find((c: any) => c.owner === 'player' && c.cardId === k);
    const foes = st.board.creatures.filter((c: any) => c.owner === 'opponent');
    const card = (k: string) => st.players.player.hand.find((x: any) => x.cardId === k);
    const d = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    const M = Tutorial2.MINE;
    const sum = (k: string, col: number) => { const c = card(k); return c ? legal.filter((x: any) => x.type === 'summon' && x.uid === c.uid).sort((a: any, b: any) => Math.abs(a.col - col) - Math.abs(b.col - col))[0] || null : null; };
    const stepTo = (u: any, goal: any, stopAt = 0) => { if (!u || d(u, goal) <= stopAt) return null; const mv = legal.filter((x: any) => x.type === 'move' && x.creatureUid === u.uid && d(x, goal) >= stopAt).sort((a: any, b: any) => d(a, goal) - d(b, goal))[0]; return mv && d(mv, goal) < d(u, goal) ? mv : null; };
    const atk = (u: any, cmd = false) => (u ? legal.find((x: any) => x.type === 'attack' && x.creatureUid === u.uid && (cmd ? x.target?.commander : x.target && !x.target.commander)) || null : null);
    const deploy = st.phase === 'deploy', action = st.phase === 'action';
    // the goals of the round, in order; whatever can be done now is done
    for (const g of (V2.chapters.find((c: any) => c.id === 'ch5')?.goals || []) as any[]) {
      if (this.goals.has(g.id) || g.round > this.round(st)) continue;
      let a: any = null;
      switch (g.id) {
        case 'g-miner': a = deploy ? sum('goblin-scrounger', M.col - 1) : null; break;
        case 'g-brawler': a = deploy ? sum('goblin-scrapper', 6) : null; break;
        case 'g-slinger': a = deploy ? sum('goblin-slinger', 7) : null; break;
        case 'g-walk-miner': a = action ? stepTo(me('goblin-scrounger'), M, 1) : null; break;
        case 'g-dig': { const m = me('goblin-scrounger'); a = action && m ? legal.find((x: any) => (x.type === 'mine' || x.type === 'mineAt') && x.creatureUid === m.uid) || stepTo(m, M, 1) : null; break; }
        case 'g-walk-brawler': { const c = foes.find((x: any) => x.cardId === 'shield-cadet'); a = action && c ? stepTo(me('goblin-scrapper'), c, 1) : null; break; }
        case 'g-attack': { const b = me('goblin-scrapper'); const c = foes.find((x: any) => x.cardId === 'shield-cadet'); a = action && b ? (legal.find((x: any) => x.type === 'attack' && x.creatureUid === b.uid && c && x.target?.row === c.row && x.target?.col === c.col) || (c ? stepTo(b, c, 1) : null)) : null; break; }
        case 'g-shoot': {
          const sl = me('goblin-slinger');
          a = action ? atk(sl) : null;
          if (!a && action && sl) { // walk to a square with a clear straight line (tried on a copy of the board)
            for (const mv of legal.filter((x: any) => x.type === 'move' && x.creatureUid === sl.uid)) {
              try { const r = applyAction(JSON.parse(JSON.stringify(st)), mv); if (r.ok && legalActions(r.state).some((x: any) => x.type === 'attack' && x.creatureUid === sl.uid && x.target && !x.target.commander)) { a = mv; break; } } catch { /* skip */ }
            }
          }
          break;
        }
        case 'g-spell': { const c = card('venom-shiv'); a = c ? legal.find((x: any) => x.type === 'cast' && x.uid === c.uid && x.target && !x.target.commander) || null : null; break; }
        case 'g-strike': a = action ? legal.find((x: any) => x.type === 'ability' && x.ability === 'bowl') || null : null; break;
        case 'g-hit-commander': case 'g-win': {
          if (!action) break;
          for (const u of [me('goblin-scrapper'), me('goblin-slinger')]) { a = atk(u, true); if (a) break; }
          if (!a) for (const u of [me('goblin-scrapper'), me('goblin-slinger')]) { a = stepTo(u, ENEMY_SH, 1); if (a) break; }
          break;
        }
      }
      if (a) return a;
    }
    if (action) { // nothing on the list now: keep pressing on the Commander
      for (const u of [me('goblin-scrapper'), me('goblin-slinger')]) { const a = atk(u, true) || (this.goals.has('g-attack') ? stepTo(u, ENEMY_SH, 1) : null); if (a) return a; }
    }
    return { type: 'done' };
  }
  /** chapter 4, step by step (the checks' hook): exactly what the step asks */
  private battleAction(st: any, legal: any[]): any | null {
    const id = this.step?.id || '';
    const me = (k: string) => st.board.creatures.find((c: any) => c.owner === 'player' && c.cardId === k);
    const card = (k: string) => st.players.player.hand.find((x: any) => x.cardId === k);
    const sum = (k: string, row: number, col: number) => { const c = card(k); return c ? legal.find((x: any) => x.type === 'summon' && x.uid === c.uid && x.row === row && x.col === col) || legal.find((x: any) => x.type === 'summon' && x.uid === c.uid) : null; };
    const d = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    switch (id) {
      case 'deploy': return sum('goblin-grunt', 7, 6);
      case 'miner': return sum('goblin-scrounger', 7, 5);
      case 'done-deploy': case 'done-deploy-2': case 'new-units-wait': case 'end-turn': return { type: 'done' };
      case 'move': { const g = me('goblin-grunt'); if (!g) return null; const to = { row: 5, col: 6 }; return legal.find((x: any) => x.type === 'move' && x.creatureUid === g.uid && x.row === 5 && x.col === 6) || legal.filter((x: any) => x.type === 'move' && x.creatureUid === g.uid).sort((a: any, b: any) => d(a, to) - d(b, to))[0] || null; }
      case 'preview': { const g = me('goblin-grunt'); return g ? legal.find((x: any) => x.type === 'attack' && x.creatureUid === g.uid && x.target && !x.target.commander) || null : null; }
      case 'mine': { const m = me('goblin-scrounger'); return m ? legal.find((x: any) => (x.type === 'mine' || x.type === 'mineAt') && x.creatureUid === m.uid) || null : null; }
      case 'commander': { const g = me('goblin-grunt'); return g ? legal.find((x: any) => x.type === 'attack' && x.creatureUid === g.uid && x.target?.commander) || null : null; }
    }
    return null;
  }
  /** the checks' hook: what the current step is and where things are */
  info() {
    const st = this.app.game.state, stp = this.step;
    const tgt = stp ? rectOf(stp.target?.(this, st) || null) : null;
    const b = this.layer?.querySelector('.tut2-bubble') as El | null, f = this.layer?.querySelector('.tut2-finger') as any;
    const br = b?.getBoundingClientRect();
    return { chapter: this.chapter?.id || null, step: stp?.id || (this.mode === 'card' ? 'card' : this.mode), advance: stp?.advance || null, target: stp?.id || null,
      rect: tgt, bubbleRect: br ? { x: br.left, y: br.top, w: br.width, h: br.height } : null, fingerTip: f?._tip || null, goals: [...this.goals], mode: this.mode };
  }
  idle(ms: number) { this.idleMs += ms; this.stepKey = ''; this.refresh(); }
}
