// Enemy turn recap (Ken, Nov 1: "sometimes stuff just happens. You're like, what in the world just happened?"):
// a short plain line for each thing the computer did, kept for its last two turns. Lines are built only when game events arrive (nothing per frame).
import { CARDS } from '../engine';

export interface RecapLine { text: string; cells: { row: number; col: number }[]; uid?: string }
export interface RecapTurn { turn: number; lines: RecapLine[] }

const nameOf = (id: string | undefined) => (id && CARDS[id]?.name) || 'A unit';

/** Lines for one batch of game events (only what the opponent did). `cardOf` finds a unit's card, also one that just died; `ownerOf` its side. */
export function recapLines(events: any[], cardOf: (uid: string) => string | undefined, ownerOf: (uid: string) => string | undefined, cardAt: (row: number, col: number) => string | undefined): RecapLine[] {
  const out: RecapLine[] = [];
  const koAt = (row: number, col: number) => events.some((x) => x.type === 'defeat' && x.row === row && x.col === col);
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'summon' && e.owner === 'opponent' && !e.illusion) out.push({ text: `played ${nameOf(e.cardId)}`, cells: e.row ? [{ row: e.row, col: e.col }] : [], uid: e.uid });
    else if (e.type === 'playCrystal' && e.player === 'opponent') out.push({ text: `played ${nameOf(e.cardId)}`, cells: [] });
    else if (e.type === 'minerUpgrade' && (e.player === 'opponent' || e.owner === 'opponent')) out.push({ text: `upgraded with ${nameOf(e.cardId)}`, cells: e.row ? [{ row: e.row, col: e.col }] : [] });
    else if (e.type === 'spell' && e.player === 'opponent') {
      const t = e.target || null;
      const on = t?.commander ? (t.commander === 'player' ? ' on your Commander' : '') : t && typeof t.row === 'number' && cardAt(t.row, t.col) ? ` on ${nameOf(cardAt(t.row, t.col))}` : '';
      const ko = t && typeof t.row === 'number' && koAt(t.row, t.col) ? ': KO' : '';
      out.push({ text: `${nameOf(e.cardId)}${on}${ko}`, cells: t && typeof t.row === 'number' ? [{ row: t.row, col: t.col }] : [] });
    } else if (e.type === 'move' && !e.knock && ownerOf(e.uid) === 'opponent') out.push({ text: `${nameOf(cardOf(e.uid))} moved`, cells: [e.to], uid: e.uid });
    else if (e.type === 'mine' && ownerOf(e.uid) === 'opponent') out.push({ text: `${nameOf(cardOf(e.uid))} mined`, cells: typeof e.row === 'number' ? [{ row: e.row, col: e.col }] : [], uid: e.uid });
    else if (e.type === 'attack' && ownerOf(e.uid) === 'opponent') {
      const who = nameOf(cardOf(e.uid)), t = e.target;
      if (t.commander) {
        const d = events.find((x, j) => j > i && x.type === 'damage' && x.commander === t.commander);
        out.push({ text: `${who} hit your Commander${d ? ` for ${d.amount}` : ''}`, cells: [], uid: e.uid });
      } else {
        const d = events.find((x, j) => j > i && x.type === 'damage' && !x.commander && x.row === t.row && x.col === t.col);
        const ko = koAt(t.row, t.col) ? ': KO' : '';
        const vic = cardAt(t.row, t.col) || (d && cardOf(d.uid));
        out.push({ text: `${who} hit ${vic ? nameOf(vic) : 'a unit'}${d ? ` for ${d.amount}` : ''}${ko}`, cells: [{ row: t.row, col: t.col }], uid: e.uid });
      }
    }
  }
  return out;
}
