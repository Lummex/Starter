// Ranks (Ken, Oct 31: "we need a ranking system. On how well you do ... a little crystal charm under your avatar that shows your rank. And shows their rank.")
// Everything about ranks lives here: the numbers come from content/rank-config.json; save()/load() keep it on this device.
// Online Phase C moves the saved record to the server: replace load()/save() and nothing else needs to change.
import RANK from '../content/rank-config.json';

export const RANK_CONFIG = RANK as typeof RANK;
const C = RANK_CONFIG;
const PER_TIER = C.divisions.length * C.pointsPerDivision;
const TOP = C.tiers.length - 1; // Oreheart: one open-ended division

export interface RankInfo { points: number; tier: number; tierName: string; division: string; label: string; inDivision: number; color: string; dark: string; divIndex: number }
/** The rank shown for a number of rank points, e.g. 437 -> Silver III, 37 points into it. */
export function rankOf(points: number): RankInfo {
  const p = Math.max(0, Math.floor(points));
  const tier = Math.min(TOP, Math.floor(p / PER_TIER));
  const t = C.tiers[tier];
  if (tier === TOP) return { points: p, tier, tierName: t.name, division: '', label: t.name, inDivision: p - TOP * PER_TIER, color: t.color, dark: t.dark, divIndex: TOP * C.divisions.length };
  const d = Math.min(C.divisions.length - 1, Math.floor((p - tier * PER_TIER) / C.pointsPerDivision));
  return { points: p, tier, tierName: t.name, division: C.divisions[d], label: `${t.name} ${C.divisions[d]}`, inDivision: p - tier * PER_TIER - d * C.pointsPerDivision, color: t.color, dark: t.dark, divIndex: tier * C.divisions.length + d };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Points for one result: a win gives more against a higher-ranked rival, a loss costs less against one. */
export function pointsFor(win: boolean, myPoints: number, rivalPoints: number): number {
  const gap = rankOf(rivalPoints).divIndex - rankOf(myPoints).divIndex;
  return win ? clamp(Math.round(C.win + C.winPerDivisionGap * gap), C.winMin, C.winMax) : -clamp(Math.round(C.loss - C.lossPerDivisionGap * gap), C.lossMin, C.lossMax);
}

export interface RankRecord { points: number; wins: number; losses: number; rivals: Record<string, { w: number; l: number }>; history: { t: number; rival: string; win: boolean; delta: number; before: number; after: number }[] }
const KEY = 'oreheart.rank';
export function load(): RankRecord {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r && typeof r.points === 'number') return { points: r.points, wins: r.wins | 0, losses: r.losses | 0, rivals: r.rivals || {}, history: Array.isArray(r.history) ? r.history : [] };
  } catch { /* storage blocked or bad data */ }
  return { points: C.startPoints, wins: 0, losses: 0, rivals: {}, history: [] };
}
export function save(r: RankRecord) { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage blocked */ } }

export interface RankResult { win: boolean; delta: number; before: RankInfo; after: RankInfo; rankedUp: boolean; rankedDown: boolean; record: { w: number; l: number } }
/** Records one ranked match against a rival: rank points, wins/losses and your record against that rival. The first tiers have a floor (no dropping below them). */
export function recordResult(win: boolean, rivalId: string, rivalPoints: number): RankResult {
  const r = load();
  const before = rankOf(r.points);
  let delta = pointsFor(win, r.points, rivalPoints);
  let after = Math.max(0, r.points + delta);
  if (!win && before.tier < C.protectedTiers) after = Math.max(after, before.tier * PER_TIER); // kid-friendly: never drop out of Stone, Copper or Iron once reached
  delta = after - r.points;
  const rec = (r.rivals[rivalId] ||= { w: 0, l: 0 });
  if (win) { r.wins++; rec.w++; } else { r.losses++; rec.l++; }
  r.history.push({ t: Date.now(), rival: rivalId, win, delta, before: r.points, after });
  if (r.history.length > 40) r.history.splice(0, r.history.length - 40);
  r.points = after;
  save(r);
  const a = rankOf(after);
  return { win, delta, before, after: a, rankedUp: a.divIndex > before.divIndex, rankedDown: a.divIndex < before.divIndex, record: { ...rec } };
}
export function recordVs(rivalId: string) { const r = load().rivals[rivalId]; return r ? { ...r } : { w: 0, l: 0 }; }
