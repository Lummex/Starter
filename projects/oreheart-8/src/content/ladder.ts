// The Ranked ladder. Nov 7 (Ken: "You got to start at zero ... start all the way at the stone one"): the step is read off the
// visible LADDER POINTS (start 0 = Stone III), not the hidden Elo (matchmaking only). Thresholds are the admin setting ranked_ladder
// on the server; these are the defaults: 300 points a step, 100 a division. Ten steps, Stone to Oreheart, with divisions III / II / I
// inside each step but the top. The same arithmetic as private.rank_of in SQL, for the mock server and for screens that only have a number.
// Every screen's "rating" number is these points.
// The older offline rank points (rank-config.json) stay for vs-computer.
export interface LadderStep { name: string; min: number }
export const DEFAULT_LADDER: LadderStep[] = [
  { name: 'Stone', min: 0 }, { name: 'Copper', min: 300 }, { name: 'Iron', min: 600 }, { name: 'Silver', min: 900 }, { name: 'Sapphire', min: 1200 },
  { name: 'Emerald', min: 1500 }, { name: 'Ruby', min: 1800 }, { name: 'Amethyst', min: 2100 }, { name: 'Diamond', min: 2400 }, { name: 'Oreheart', min: 2700 },
];
/** where an Elo rating pulls the ladder points (private.points_target): 1200 + 6 x (Elo - 1000), 0..3000 */
export const pointsTarget = (elo: number) => Math.min(3000, Math.max(0, 1200 + 6 * ((Number(elo) || 1000) - 1000)));
/** the points change for one ranked game, score 1 / 0 / 0.5 (private.points_delta): fast out of Stone, settles where the Elo says */
export function pointsDelta(points: number, elo: number, score: number): number {
  const gap = pointsTarget(elo) - points, r = (x: number) => Math.round(x);
  if (score >= 1) return Math.min(60, Math.max(10, r(20 + 0.04 * gap)));
  if (score <= 0) return -Math.min(40, Math.max(5, r(20 - 0.04 * gap)));
  return Math.min(10, Math.max(-10, r(0.02 * gap)));
}
export interface LadderRank { tier: number; name: string; division: '' | 'III' | 'II' | 'I'; label: string; floor: number; next: number | null; divFloor: number; divNext: number | null; progress: number }
const DIVS: ('III' | 'II' | 'I')[] = ['III', 'II', 'I'];
/** the step, division and label for a rating (e.g. 1016 -> Sapphire III, 1134 -> Emerald II) */
export function rankOfRating(rating: number, ladder: LadderStep[] = DEFAULT_LADDER): LadderRank {
  const r = Math.max(0, Math.floor(Number(rating) || 0));
  const steps = ladder && ladder.length ? ladder.slice().sort((a, b) => a.min - b.min) : DEFAULT_LADDER;
  let t = 0;
  for (let i = 0; i < steps.length; i++) if (r >= steps[i].min) t = i;
  const floor = steps[t].min, next = t < steps.length - 1 ? steps[t + 1].min : null;
  if (next == null) return { tier: t, name: steps[t].name, division: '', label: steps[t].name, floor, next: null, divFloor: floor, divNext: null, progress: 1 };
  const span = Math.max(1, next - floor);
  const d = Math.min(2, Math.max(0, Math.floor(((r - floor) * 3) / span)));
  const divFloor = floor + Math.floor((span * d) / 3), divNext = d === 2 ? next : floor + Math.floor((span * (d + 1)) / 3);
  const progress = Math.min(1, Math.max(0, (r - divFloor) / Math.max(1, divNext - divFloor)));
  return { tier: t, name: steps[t].name, division: DIVS[d], label: `${steps[t].name} ${DIVS[d]}`, floor, next, divFloor, divNext, progress: Math.round(progress * 1000) / 1000 };
}
/** the charm picture for a step (public/art/ui/rank-charms/<name>.webp) */
export const ladderCharm = (name: string) => `/art/ui/rank-charms/${String(name || 'stone').toLowerCase()}.webp`;
