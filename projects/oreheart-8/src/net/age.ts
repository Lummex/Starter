// Age groups (Ken, Oct 28 + Oct 31). The browser works the group out from the birth month and year the player
// typed; ONLY the group ever reaches the server (never the birth date). under_13 = parent consent path (COPPA);
// 13_plus = 13 to 15; 16_plus = may see and pick the mature avatars (Ken, Oct 31: "kids under 16 shouldn't see
// racier imagery"). Nothing about this is ever shown to players.
export type AgeGroup = '13_plus' | 'under_13' | '16_plus';
export const AGE_GROUPS: AgeGroup[] = ['13_plus', 'under_13', '16_plus'];

export function monthsOld(month: number, year: number, now = new Date()): number {
  return (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
}
export function underThirteen(month: number, year: number, now = new Date()): boolean {
  return monthsOld(month, year, now) < 13 * 12;
}
export function sixteenPlus(month: number, year: number, now = new Date()): boolean {
  return monthsOld(month, year, now) >= 16 * 12;
}
export function ageGroupFor(month: number, year: number, now = new Date()): AgeGroup {
  if (underThirteen(month, year, now)) return 'under_13';
  return sixteenPlus(month, year, now) ? '16_plus' : '13_plus';
}
/** Restricted unless the account's stored group is 16_plus: under 16, signed out and offline all count as restricted. */
export const canSeeMature = (group: string | null | undefined): boolean => group === '16_plus';
