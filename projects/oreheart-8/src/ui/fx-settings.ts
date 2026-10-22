// Round 11: player-customizable square highlights and unit rings (saved in localStorage, applied through CSS variables / the 3D scene).
export interface HighlightSettings { edgeColor: string | null; glowColor: string | null; attackColor: string; strength: number; glowSize: number; edgeThickness: number; fill: number; pulse: boolean; pulseSpeed: number }
export interface RingSettings { myColor: string | null; enemyColor: string | null; movedColor: string | null; greyAmount: number; thickness: number; glow: number; opacity: number }
export const HL_DEFAULT: HighlightSettings = { edgeColor: null, glowColor: null, attackColor: '#ff2a2a', strength: 1, glowSize: 30, edgeThickness: 4, fill: 14, pulse: true, pulseSpeed: 1.2 };
export const RING_DEFAULT: RingSettings = { myColor: null, enemyColor: null, movedColor: '#808080', greyAmount: 0.8, thickness: 1, glow: 0.3, opacity: 1 };
const FACTION_MAIN: Record<string, string> = { goblins: '#3ee06a', gnomes: '#9b4dff', dwarves: '#2f5fd8' };
const FACTION_HI: Record<string, string> = { goblins: '#b45cff', gnomes: '#3fa9ff', dwarves: '#ffd700' };
const load = <T>(key: string, d: T): T => { try { return { ...d, ...(JSON.parse(localStorage.getItem(key) || '{}') || {}) }; } catch { return { ...d }; } };
let hl: HighlightSettings = load('oreheart.highlights', HL_DEFAULT);
let rg: RingSettings = load('oreheart.rings', RING_DEFAULT);
export const getHighlights = (): HighlightSettings => ({ ...hl });
export const getRings = (): RingSettings => ({ ...rg });
export function setHighlights(p: Partial<HighlightSettings>) { hl = { ...hl, ...p }; localStorage.setItem('oreheart.highlights', JSON.stringify(hl)); applyHighlightVars(); }
export function setRings(p: Partial<RingSettings>) { rg = { ...rg, ...p }; localStorage.setItem('oreheart.rings', JSON.stringify(rg)); }
export const resetHighlights = () => { hl = { ...HL_DEFAULT }; localStorage.removeItem('oreheart.highlights'); applyHighlightVars(); };
export const resetRings = () => { rg = { ...RING_DEFAULT }; localStorage.removeItem('oreheart.rings'); };
/** Edge / glow colors for a faction (the player's faction main + highlight colors unless overridden). */
export const edgeOf = (faction: string) => hl.edgeColor || FACTION_MAIN[faction] || '#3ee06a';
export const glowOf = (faction: string) => hl.glowColor || FACTION_HI[faction] || '#b45cff';
export const mainOf = (faction: string) => FACTION_MAIN[faction] || '#3ee06a';
export function applyHighlightVars(faction?: string, el: HTMLElement = document.documentElement) {
  if (faction) (applyHighlightVars as any).f = faction;
  const f = faction || (applyHighlightVars as any).f || 'goblins';
  const s = el.style;
  s.setProperty('--hl-edge', edgeOf(f)); s.setProperty('--hl-glow', glowOf(f)); s.setProperty('--hl-att', hl.attackColor);
  s.setProperty('--hl-str', String(hl.strength)); s.setProperty('--hl-size', hl.glowSize + 'px'); s.setProperty('--hl-th', hl.edgeThickness + 'px');
  s.setProperty('--hl-fill', String(Math.round(hl.fill)) + '%'); s.setProperty('--hl-pulse', hl.pulse ? `${(2.4 / Math.max(0.2, hl.pulseSpeed)).toFixed(2)}s` : '0s');
}
const mix = (a: string, b: string, t: number) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + ((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0'); };
/** The ring color of a unit: its side's color, or the greyed color once it has moved/acted. */
export function ringColor(side: 'player' | 'opponent', faction: string, acted: boolean): string {
  const base = (side === 'player' ? rg.myColor : rg.enemyColor) || mainOf(faction);
  if (!acted) return base.toLowerCase();
  return mix(base, rg.movedColor || '#808080', rg.greyAmount).toLowerCase();
}
