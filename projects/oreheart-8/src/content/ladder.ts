// The Ranked ladder (Forge, Nov 5): ONE number, the Elo rating; the step is read off it with thresholds (the admin setting
// ranked_ladder on the server; these are the defaults). Ten steps, Stone to Oreheart, with divisions III / II / I inside each
// step but the top. The same arithmetic as private.rank_of in SQL, for the mock server and for screens that only have a rating.
// The older offline rank points (rank-config.json) stay for vs-computer.
export interface LadderStep { name: string; min: number }
export const DEFAULT_LADDER: LadderStep[] = [
  { name: 'Stone', min: 0 }, { name: 'Copper', min: 700 }, { name: 'Iron', min: 800 }, { name: 'Silver', min: 900 }, { name: 'Sapphire', min: 1000 },
  { name: 'Emerald', min: 1100 }, { name: 'Ruby', min: 1200 }, { name: 'Amethyst', min: 1300 }, { name: 'Diamond', min: 1400 }, { name: 'Oreheart', min: 1500 },
];
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
