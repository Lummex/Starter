// Rival playstyles (Ken, Oct 31: the computer "plays like a human with a playstyle (defensive, the most common; reckless; Miner-protector; and so on),
// reads the player's style from the board, and switches plans when needed", and never cheats: nothing here reads the player's hand or deck).
//
// A style is a set of weights over the AI's evaluation (ai.ts). A PLAN is the style's current mood, read from the VISIBLE board each decision:
// unit positions, who guards what, which mines are held, both Commanders' Health. It is a pure function of the state, so the Worker stays stateless
// and replays stay step for step the same. 'balanced' with its 'steady' plan is exactly the computer as it was before styles.
import { CARDS, CONFIG, isMiner, other, nextPool } from '../engine';

export type StyleId = 'balanced' | 'turtle' | 'reckless' | 'economy' | 'rush' | 'tricky';
export const STYLE_IDS: StyleId[] = ['balanced', 'turtle', 'reckless', 'economy', 'rush', 'tricky'];
export const STYLE_LABEL: Record<StyleId, string> = { balanced: 'Balanced', turtle: 'Defensive', reckless: 'Reckless', economy: 'Miner-protector', rush: 'Commander-rush', tricky: 'Tricky' };
export const isStyle = (x: any): x is StyleId => STYLE_IDS.includes(x);

/** Multipliers on the evaluation (1 = as before). threat: danger to own units and Commander; fwd: the urge to move forward; race: how much distance to the enemy
 *  Commander counts AGAINST going there (more = less racing); cmd: Commander Health; econ: next turn's crystals; foeMiner: enemy Miners as targets; special/cast: the bonus for
 *  abilities / spells; mine: the bonus for mining; press: units already at the enemy Commander; guard: the pull home when enemies near our Commander; minerGuard: danger to our
 *  own Miners; home: a bonus per fighter for staying near our Commander. */
export interface StyleW { threat: number; fwd: number; race: number; cmd: number; econ: number; foeMiner: number; special: number; cast: number; mine: number; press: number; guard: number; minerGuard: number; home: number; /** a bonus on attacking (1 = none) */ attack: number }
const W = (o: Partial<StyleW> = {}): StyleW => ({ threat: 1, fwd: 1, race: 1, cmd: 1, econ: 1, foeMiner: 1, special: 1, cast: 1, mine: 1, press: 1, guard: 1, minerGuard: 1, home: 0, attack: 1, ...o });

/** Each style's plans. The first plan is its default mood; the others are what it switches to when the board calls for it (planFor below). */
export const STYLES: Record<StyleId, Record<string, StyleW>> = {
  balanced: { steady: W() },
  turtle: {
    hold: W({ threat: 1.6, fwd: 0.45, race: 1.6, press: 0.6, guard: 1.6, minerGuard: 1.4, home: 2.2, special: 0.9 }),
    build: W({ threat: 1.4, fwd: 0.5, race: 1.6, press: 0.6, guard: 1.4, econ: 1.4, mine: 1.4, home: 1.6 }),
    counterpush: W({ threat: 0.9, fwd: 1.3, race: 0.8, cmd: 1.3, press: 1.3, guard: 1.1, home: 0 }),
  },
  reckless: {
    allout: W({ threat: 0.62, fwd: 1.6, race: 0.8, cmd: 1.3, press: 1.4, guard: 0.6, minerGuard: 0.55, special: 1.2, econ: 0.75, mine: 0.65, attack: 2.2 }), // (threat 0.5 made a Hard reckless rival as soft as Medium in the sims) // fights everything in reach, fears little (sims: a lower race weight made it walk past enemies and die)
    regroup: W({ threat: 1.3, fwd: 0.6, race: 1.2, guard: 1.6, home: 1.5, cmd: 1.1 }),
  },
  economy: {
    build: W({ econ: 1.7, mine: 1.6, minerGuard: 2, guard: 1.2, fwd: 0.8, race: 1.3, foeMiner: 1.3, home: 0.4 }),
    fortify: W({ econ: 1.5, mine: 1.3, minerGuard: 3, guard: 1.5, threat: 1.3, fwd: 0.7, race: 1.3, home: 0.8, attack: 1.3 }), // its fighters go for whatever stands near its Miners (minerGuard also pulls them there, ai.ts)
    hunt: W({ econ: 1.4, mine: 1.3, minerGuard: 1.8, foeMiner: 2.4, fwd: 1.1, race: 1.3 }),
  },
  rush: {
    siege: W({ cmd: 1.8, press: 1.6, race: 0.7, fwd: 1.4, threat: 0.8, guard: 0.7, econ: 0.8, mine: 0.7, attack: 1.3 }), // the Commander is the prize, but it still clears what blocks the road
    finish: W({ cmd: 2.4, press: 2.4, race: 0.45, fwd: 1.6, threat: 0.6, guard: 0.5, econ: 0.6, mine: 0.5, attack: 1.5 }),
    hold: W({ threat: 1.4, fwd: 0.6, race: 1.3, guard: 1.6, home: 1.5 }),
  },
  tricky: {
    tricks: W({ special: 2.4, cast: 2.8, threat: 1.1, fwd: 0.85, race: 1.1, econ: 1.1 }),
    steady: W(),
  },
};

const cheb = (a: any, b: any) => Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
const sh = (p: string) => ({ row: CONFIG.strongholds[p][0], col: CONFIG.strongholds[p][1] });
const fighter = (c: any) => !isMiner(CARDS[c.cardId]);

/** What the visible board says about the player (the enemy of `me`): nothing hidden is read. */
export interface PlayerRead {
  /** 0..2: how hard their fighters press our Commander (within 4 squares, by Attack and closeness) */ rush: number;
  /** share of their fighters within 1 row of their own back row (0..1); high = they turtle */ turtle: number;
  /** their fighters that have crossed the middle of the board */ forward: number;
  /** their fighters guarding their own Commander (within 3 squares) */ guards: number;
  /** true when they press forward with their Commander left thin */ overextended: boolean;
  /** our fighters minus theirs */ lead: number;
  /** mines they hold minus mines we hold */ mineGap: number;
  /** their next-turn crystals minus ours */ flowGap: number;
  /** our Miners with an enemy fighter within reach next turn */ minersInDanger: number;
  /** spells and usable abilities in OUR hand / on our board (never theirs) */ tricksInHand: number;
  myHealth: number; foeHealth: number;
}
export function readPlayer(s: any, me: string): PlayerRead {
  const foe = other(me as any);
  const myHome = sh(me), foeHome = sh(foe);
  const H = CONFIG.boardHeight, mid = (H + 1) / 2;
  const foeBack = CONFIG.backRow[foe];
  let rush = 0, foeF = 0, myF = 0, back = 0, forward = 0, guards = 0;
  const myMiners: any[] = [], foeFighters: any[] = [];
  for (const c of s.board.creatures) {
    if (c.owner === foe) {
      if (!fighter(c)) continue;
      foeF++; foeFighters.push(c);
      const d = cheb(c, myHome);
      if (d <= 4) rush += Math.max(1, c.attack + (c.upgrades?.attack || 0)) * (5 - d) / 4;
      if (Math.abs(c.row - foeBack) <= 1) back++;
      if (me === 'player' ? c.row > mid : c.row < mid) forward++; // across the middle, toward us
      if (cheb(c, foeHome) <= 3) guards++;
    } else if (fighter(c)) myF++;
    else myMiners.push(c);
  }
  const held = (who: string) => s.sites.filter((x: any) => {
    let n = 0;
    for (const c of s.board.creatures) if (c.minedMine && c.minedMine.row === x.row && c.minedMine.col === x.col && cheb(c, x) <= 1) n += c.owner === who ? 1 : -1;
    return n > 0;
  }).length;
  let minersInDanger = 0;
  for (const m of myMiners) if (foeFighters.some((f) => cheb(f, m) <= (CARDS[f.cardId].abilities?.includes('ranged') ? 3 : (CARDS[f.cardId].move || 1) + 1))) minersInDanger++; // a fighter that can reach the Miner next turn, or a shooter close by
  const hand = s.players[me].hand;
  let tricks = 0;
  for (const h of hand) if (CARDS[h.cardId]?.type === 'spell') tricks++;
  for (const c of s.board.creatures) if (c.owner === me && (CARDS[c.cardId].abilities || []).some((k: string) => !['ranged', 'gather', 'tunnel', 'smith', 'haste', 'sneaky', 'charge'].includes(k))) tricks += 0.5;
  return {
    rush: Math.max(0, Math.min(2, rush / 6)), turtle: foeF ? back / foeF : 0, forward, guards,
    overextended: forward >= 2 && guards <= 1 && forward >= foeF * 0.5,
    lead: myF - foeF, mineGap: held(foe) - held(me), flowGap: nextPool(s, foe as any) - nextPool(s, me as any),
    minersInDanger, tricksInHand: tricks, myHealth: s.players[me].health, foeHealth: s.players[foe].health,
  };
}

/** The plan a style follows on this board, and its weights. Pure: the same board always gives the same plan. */
export function planFor(s: any, me: string, style: StyleId): { style: StyleId; plan: string; w: StyleW; read: PlayerRead } {
  const read = readPlayer(s, me);
  const plans = STYLES[style] || STYLES.balanced;
  let plan = Object.keys(plans)[0];
  switch (style) {
    case 'turtle':
      // the turtle counter-pushes when the player overextends (or their Commander is already low and we hold the units), and builds its economy against a player who turtles too
      if ((read.overextended && read.lead >= 0 && read.rush < 0.8) || (read.foeHealth <= 8 && read.lead >= 1 && read.rush < 0.5)) plan = 'counterpush';
      else if (read.turtle >= 0.6 && read.rush < 0.3) plan = 'build';
      break;
    case 'reckless':
      // all out, until its own Commander is in real danger
      if (read.myHealth <= 7 && read.rush >= 0.6) plan = 'regroup';
      break;
    case 'economy':
      if (read.minersInDanger >= 1 && read.rush < 1.2) plan = 'fortify';
      else if (read.mineGap >= 1 || read.flowGap >= 3) plan = 'hunt';
      break;
    case 'rush':
      if (read.myHealth <= 6 && read.rush >= 0.5) plan = 'hold';
      else if (read.foeHealth <= 6) plan = 'finish';
      break;
    case 'tricky':
      if (read.tricksInHand < 1) plan = 'steady';
      break;
  }
  return { style, plan, w: plans[plan], read };
}
