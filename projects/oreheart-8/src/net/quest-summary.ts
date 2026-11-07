// Daily quests: what one finished match counts for (contract part 4.3). Pure: no DOM, no network.
//
// Where each number comes from (event names read from src/engine/engine.ts, `ev.push({ type: ... })`):
//   turns            finalState.turn (both sides' turns added up, the same number the PvP referee reports)
//   won / wins       finalState.winner === mySide
//   commander        finalState.players[mySide].commanderId
//   creaturesPlayed  'summon' with owner === mySide (Illusion copies, `illusion: true`, are not plays)
//   cardsByFaction   my plays by the card's faction: 'summon' (not illusions), 'cast' and 'respond' (player === mySide),
//                    'minerUpgrade' (an upgrade card I played on one of my units); neutral cards count for no faction
//   cost7Plays       the same plays, when the card's printed cost is 7 or more
//   hitsLanded       'swing' with result 'hit' whose attacker (uid) is mine
//   hitsBlocked      'swing' with result 'block' aimed at my unit (targetUid) or at my Commander (commander === mySide),
//                    plus 'shieldBlock' on my unit (a shield or bubble soaked the hit)
//   unitsDefeated    'defeat' of an enemy unit (owner !== mySide) while I was the one acting: the latest 'attack' / 'bowl' /
//                    'abilityUsed' was by my unit, or the latest 'spell' / 'cast' / 'respond' was mine
//   commanderDamage  'damage' with commander === the enemy side (sum of amount)
//   mineHoldTurns    the longest run of my consecutive turns (from 'turnStart') in which my units mined the same mine square
//   minerMines       'mine' events by my units whose card is a Miner (Gatherer or Smith)
// Which side owns a uid: 'summon' / 'defeat' events, then the final board, hands, decks and discard piles.
import { COMMANDER_PACK_IDS, commanderPackCard } from '../content/card-labels';
import { CARDS, isMiner } from '../engine';

export interface Summary {
  turns: number; won: boolean; commander: string; battles: 1; wins: 0 | 1;
  creaturesPlayed: number; cardsByFaction: { goblins: number; gnomes: number; dwarves: number };
  cost7Plays: number; hitsLanded: number; hitsBlocked: number; unitsDefeated: number; commanderDamage: number;
  mineHoldTurns: number; minerMines: number;
}

/** The server's per-report limits (Helper A enforces the same numbers in quest_report). */
export const QUEST_CAPS = { turns: 60, creaturesPlayed: 60, cost7Plays: 20, hitsLanded: 200, hitsBlocked: 100, unitsDefeated: 60, commanderDamage: 60, mineHoldTurns: 60, minerMines: 120 } as const;
export const MIN_TURNS = 3;

const FACTIONS = ['goblins', 'gnomes', 'dwarves'] as const;

export function summarize(events: any[], finalState: any, mySide = 'player'): Summary {
  const ev = Array.isArray(events) ? events : [];
  const st = finalState || {};
  const owner = new Map<string, string>();
  const cardOf = new Map<string, string>();
  const note = (uid: any, side: any, cardId?: any) => { if (uid == null) return; const k = String(uid); if (side && !owner.has(k)) owner.set(k, side); if (cardId && !cardOf.has(k)) cardOf.set(k, cardId); };
  for (const e of ev) if (e && (e.type === 'summon' || e.type === 'defeat')) note(e.uid, e.owner, e.cardId);
  for (const c of st.board?.creatures || []) note(c.uid, c.owner, c.cardId);
  for (const side of ['player', 'opponent']) {
    const p = st.players?.[side];
    if (!p) continue;
    for (const pile of [p.hand, p.deck, p.discard]) for (const c of pile || []) note(c.uid, side, c.cardId);
  }
  const mine = (uid: any) => uid != null && owner.get(String(uid)) === mySide;

  const s: Summary = { turns: Math.max(0, Math.floor(+st.turn || 0)), won: !!st.winner && st.winner === mySide, commander: String(st.players?.[mySide]?.commanderId || ''), battles: 1, wins: 0,
    creaturesPlayed: 0, cardsByFaction: { goblins: 0, gnomes: 0, dwarves: 0 }, cost7Plays: 0, hitsLanded: 0, hitsBlocked: 0, unitsDefeated: 0, commanderDamage: 0, mineHoldTurns: 0, minerMines: 0 };
  s.wins = s.won ? 1 : 0;

  const played = (cardId: any) => {
    const c: any = (CARDS as any)[cardId];
    if (!c) return;
    if ((FACTIONS as readonly string[]).includes(c.faction)) s.cardsByFaction[c.faction as 'goblins'] += 1;
    if ((+c.cost || 0) >= 7) s.cost7Plays += 1;
  };

  let actor: string | null = null; // who is acting right now (for defeats)
  let myTurn = 0; // number of my current turn (0 = not my turn)
  let myTurns = 0;
  let minedNow = new Set<string>();
  const runs = new Map<string, { last: number; len: number }>();
  const closeTurn = () => {
    if (!myTurn) return;
    for (const sq of minedNow) {
      const r = runs.get(sq);
      const len = r && r.last === myTurn - 1 ? r.len + 1 : 1;
      runs.set(sq, { last: myTurn, len });
      if (len > s.mineHoldTurns) s.mineHoldTurns = len;
    }
    minedNow = new Set();
  };

  for (const e of ev) {
    if (!e || typeof e.type !== 'string') continue;
    switch (e.type) {
      case 'turnStart':
        closeTurn();
        actor = e.player ?? null;
        if (e.player === mySide) { myTurns += 1; myTurn = myTurns; } else myTurn = 0;
        break;
      case 'summon':
        if (e.owner === mySide && !e.illusion) { s.creaturesPlayed += 1; played(e.cardId); }
        break;
      case 'cast': case 'respond':
        actor = e.player ?? actor;
        if (e.player === mySide) played(e.cardId);
        break;
      case 'spell':
        actor = e.player ?? actor;
        break;
      case 'minerUpgrade':
        if (mine(e.uid)) played(e.cardId);
        break;
      case 'attack': case 'bowl': case 'abilityUsed':
        if (e.uid != null && owner.has(String(e.uid))) actor = owner.get(String(e.uid))!;
        break;
      case 'swing':
        if (e.result === 'hit' && mine(e.uid)) s.hitsLanded += 1;
        else if (e.result === 'block' && (e.commander != null ? e.commander === mySide : mine(e.targetUid))) s.hitsBlocked += 1;
        break;
      case 'shieldBlock':
        if (mine(e.uid)) s.hitsBlocked += 1;
        break;
      case 'defeat':
        if (e.owner && e.owner !== mySide && !e.illusion && actor === mySide) s.unitsDefeated += 1;
        break;
      case 'damage':
        if (e.commander != null && e.commander !== mySide) s.commanderDamage += Math.max(0, +e.amount || 0);
        break;
      case 'mine':
        if (mine(e.uid)) {
          const card: any = (CARDS as any)[cardOf.get(String(e.uid)) || ''];
          if (!card || isMiner(card)) s.minerMines += 1;
          if (myTurn) minedNow.add(`${e.row},${e.col}`);
        }
        break;
    }
  }
  closeTurn();
  return s;
}

/** The same limits the server applies: each number capped, and a match shorter than 3 turns counts for nothing. */
export function capSummary(s: Summary): Summary {
  const c = (v: number, max: number) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  const zero = { goblins: 0, gnomes: 0, dwarves: 0 };
  if ((+s.turns || 0) < MIN_TURNS) {
    return { ...s, turns: c(s.turns, QUEST_CAPS.turns), battles: 1, wins: 0, won: false, creaturesPlayed: 0, cardsByFaction: zero, cost7Plays: 0, hitsLanded: 0, hitsBlocked: 0, unitsDefeated: 0, commanderDamage: 0, mineHoldTurns: 0, minerMines: 0 };
  }
  const f = s.cardsByFaction || zero;
  return {
    ...s, turns: c(s.turns, QUEST_CAPS.turns), creaturesPlayed: c(s.creaturesPlayed, QUEST_CAPS.creaturesPlayed),
    cardsByFaction: { goblins: c(f.goblins, QUEST_CAPS.creaturesPlayed), gnomes: c(f.gnomes, QUEST_CAPS.creaturesPlayed), dwarves: c(f.dwarves, QUEST_CAPS.creaturesPlayed) },
    cost7Plays: c(s.cost7Plays, QUEST_CAPS.cost7Plays), hitsLanded: c(s.hitsLanded, QUEST_CAPS.hitsLanded), hitsBlocked: c(s.hitsBlocked, QUEST_CAPS.hitsBlocked),
    unitsDefeated: c(s.unitsDefeated, QUEST_CAPS.unitsDefeated), commanderDamage: c(s.commanderDamage, QUEST_CAPS.commanderDamage),
    mineHoldTurns: c(s.mineHoldTurns, QUEST_CAPS.mineHoldTurns), minerMines: c(s.minerMines, QUEST_CAPS.minerMines),
  };
}

// ------------------------------------------------------------------ small pure helpers shared by the screens (unit-tested in node)
const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Ultra Rare', 'Collector'];
const RARITY_SHOWN: Record<string, string> = { Collector: 'Legendary' }; // Ken, Nov 5: the top rarity reads Legendary (keys stay 'Collector')
const shownR = (r: string) => RARITY_SHOWN[r] || r;
const pct = (bp: number) => { const v = Math.round(bp) / 100; return (Number.isInteger(v) ? String(v) : v.toFixed(v < 1 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, '')) + '%'; };
/** "11 cards: 3 Miners, 4 Common, 2 Uncommon, 1 Rare, 1 Rare or better: Rare 78%, Ultra Rare 20%, Legendary 2%" */
export function oddsWords(slots: { slot_no: number; count: number; odds: Record<string, number>; pool?: string }[]): string {
  const ss = [...(slots || [])].sort((a, b) => a.slot_no - b.slot_no);
  const total = ss.reduce((n, s) => n + (+s.count || 0), 0);
  const parts = ss.map((s) => {
    if (s.pool === 'miners') return `${s.count} Miner${s.count === 1 ? '' : 's'}`; // Nov 5 (Ken): the Miner slot
    const rs = RARITY_ORDER.filter((r) => (s.odds?.[r] || 0) > 0);
    const extra = Object.keys(s.odds || {}).filter((r) => !RARITY_ORDER.includes(r) && (s.odds[r] || 0) > 0);
    const all = [...rs, ...extra];
    if (all.length === 1) return `${s.count} ${shownR(all[0])}`;
    if (!all.length) return `${s.count} card${s.count === 1 ? '' : 's'}`;
    return `${s.count} ${shownR(all[0])} or better: ${all.map((r) => `${shownR(r)} ${pct(s.odds[r])}`).join(', ')}`;
  });
  return `${total} card${total === 1 ? '' : 's'}: ${parts.join(', ')}`;
}

/** "Ends today", "1 day left", "3 days left" (dates as YYYY-MM-DD). */
export function daysLeft(expires: string, today: string): string {
  const a = Date.parse(String(expires).slice(0, 10) + 'T00:00:00Z'), b = Date.parse(String(today).slice(0, 10) + 'T00:00:00Z');
  if (!isFinite(a) || !isFinite(b)) return '';
  const n = Math.round((a - b) / 864e5);
  return n <= 0 ? 'Ends today' : n === 1 ? '1 day left' : `${n} days left`;
}

/** Which painted pack belongs to a pack type (Brush's file names). `standard` is the crystal-heart "general" pack. */
export function packArtName(p: { id?: string; art?: string | null; faction?: string | null } | null): string {
  const known = ['general', 'goblin', 'gnome', 'dwarf'];
  const a = String(p?.art || '').toLowerCase();
  for (const k of known) if (a === k || a.includes('pack-' + k) || a === '/art/packs/' + k + '.webp') return k;
  const id = String(p?.id || '').toLowerCase();
  if (known.includes(id)) return id;
  const f = String(p?.faction || '').toLowerCase();
  if (f === 'goblins') return 'goblin';
  if (f === 'gnomes') return 'gnome';
  if (f === 'dwarves') return 'dwarf';
  return 'general';
}
export const packArt = (p: any, part: '' | '-body' | '-top' | '-shine' = '') => `/art/packs/pack-${packArtName(p)}${part}.webp`;

const ORDER = ['goblins', 'gnomes', 'dwarves', 'any'];
const TYPE_ORDER: Record<string, number> = { creature: 0, spell: 1, crystal: 2 };

export const collectionCards = () => ([...(Object.values(CARDS) as any[]), ...COMMANDER_PACK_IDS.map((id) => commanderPackCard(id)).filter(Boolean)] as any[]).filter((c) => !c.disabled) // Nov 5: the three Commanders are collection cards too
  .sort((a, b) => ORDER.indexOf(a.faction) - ORDER.indexOf(b.faction) || (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3) || (a.cost || 0) - (b.cost || 0) || a.name.localeCompare(b.name));

/** "You own 123 cards (61 of 65 different)": crystals are owned cards like any other (Nov 5). */
export function countLine(owned: Record<string, number>, cards = collectionCards()): string {
  let copies = 0, diff = 0;
  for (const c of cards) { const n = owned[c.id] || 0; copies += n; if (n > 0) diff++; }
  return `You own ${copies} card${copies === 1 ? '' : 's'} (${diff} of ${cards.length} different)`;
}

