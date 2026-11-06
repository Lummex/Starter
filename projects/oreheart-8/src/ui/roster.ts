// The computer's rivals (Ken, Oct 31: "keep them in a list so you can play the same guys over and over again ... give them different skill levels. Or different ranks.")
// 60 named rivals, 20 per faction: a username, a Commander, a playstyle label, a skill (the Easy / Medium / Hard computer) and a rank.
// Matchmaking: the difficulty you pick chooses the band; inside it, a rival whose rank is near yours.
import { COMMANDERS } from '../engine';
import { AI_NAMES } from './players';
import { RANK_CONFIG } from './rank';
import { rivalAvatars } from './avatars';
import { StyleId, STYLE_LABEL } from '../ai/styles';

export type Skill = 'easy' | 'medium' | 'hard';
export interface Rival { id: string; name: string; faction: string; commander: string; style: StyleId; styleLabel: string; skill: Skill; points: number; avatar: string }
/** Ken, Oct 31: the rival's playstyle drives how the computer plays (ai/styles.ts). Defensive is the most common; 20 rivals per faction: 6 Defensive, 4 Balanced, 3 Reckless, 3 Miner-protector, 2 Commander-rush, 2 Tricky. */
const STYLE_PATTERN: StyleId[] = ['turtle', 'balanced', 'reckless', 'turtle', 'economy', 'rush', 'turtle', 'tricky', 'balanced', 'turtle', 'reckless', 'economy', 'turtle', 'balanced', 'rush', 'turtle', 'tricky', 'reckless', 'economy', 'balanced'];
export { STYLE_LABEL };
const SKILLS: Skill[] = ['easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'easy', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'hard', 'hard', 'hard', 'hard', 'hard', 'hard'];

function build(): Rival[] {
  const out: Rival[] = [];
  const factions: ('goblins' | 'gnomes' | 'dwarves')[] = ['goblins', 'gnomes', 'dwarves'];
  const shared = AI_NAMES.any.slice();
  factions.forEach((faction, fi) => {
    const commander = Object.values(COMMANDERS).find((c: any) => c.faction === faction && c.playable !== false)?.id || 'grubnak';
    const names = AI_NAMES[faction].slice(0, 18).concat(shared.slice(fi * 2, fi * 2 + 2));
    const per: Record<Skill, number> = { easy: 0, medium: 0, hard: 0 };
    const avs = rivalAvatars(faction);
    const count: Record<Skill, number> = { easy: SKILLS.filter((s) => s === 'easy').length, medium: SKILLS.filter((s) => s === 'medium').length, hard: SKILLS.filter((s) => s === 'hard').length };
    names.forEach((name, i) => {
      const skill = SKILLS[i];
      const [lo, hi] = (RANK_CONFIG.rivalBands as any)[skill] as [number, number];
      const k = per[skill]++;
      // spread each skill's rivals across its band; the three factions are offset a little so their ranks don't line up exactly
      const points = Math.round(lo + ((hi - lo) * (k + 0.25 + fi * 0.25)) / count[skill]);
      const style = STYLE_PATTERN[(i + 7 * fi) % STYLE_PATTERN.length];
      out.push({ id: `${faction}-${i + 1}`, name, faction, commander, style, styleLabel: STYLE_LABEL[style], skill, points, avatar: avs.length ? avs[i % avs.length] : '' });
    });
  });
  return out;
}
export const ROSTER: Rival[] = build();
export const rivalById = (id: string) => ROSTER.find((r) => r.id === id) || null;

/** A rival for a match: the right skill, near your rank; `opponentCommander` (when a match already names one) keeps that Commander; otherwise avoid a mirror of yours.
 *  Picks at random among the `matchmakingPool` nearest so the same one does not come every time. */
export function matchRival(myPoints: number, skill: string, playerCommander?: string, opponentCommander?: string, rand: () => number = Math.random): Rival {
  const sk = (skill === 'easy' || skill === 'hard' ? skill : 'medium') as Skill; // the game's Medium is 'normal'
  let pool = ROSTER.filter((r) => r.skill === sk);
  if (opponentCommander) { const same = pool.filter((r) => r.commander === opponentCommander); if (same.length) pool = same; }
  else if (playerCommander) { const other = pool.filter((r) => r.commander !== playerCommander); if (other.length) pool = other; }
  pool = pool.slice().sort((a, b) => Math.abs(a.points - myPoints) - Math.abs(b.points - myPoints));
  const n = Math.max(1, Math.min(pool.length, RANK_CONFIG.matchmakingPool));
  return pool[Math.floor(rand() * n) % n];
}
