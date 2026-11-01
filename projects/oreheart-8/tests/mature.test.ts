// Mature avatars + age groups (Ken, Oct 31): under 16, signed out and offline are restricted; nothing is shown about it.
import { describe, it, expect } from 'vitest';
import { ageGroupFor, canSeeMature, sixteenPlus, underThirteen } from '../src/net/age';
import { aiAvatars, avatarAsSeenBy, visibleAvatars, type AvatarEntry } from '../src/net/mature';

const now = new Date(2026, 9, 31); // 31 Oct 2026
describe('age groups from the birth month and year', () => {
  it('under 13', () => { expect(underThirteen(11, 2013, now)).toBe(true); expect(ageGroupFor(11, 2013, now)).toBe('under_13'); });
  it('13 this month is 13_plus', () => { expect(ageGroupFor(10, 2013, now)).toBe('13_plus'); });
  it('15 is 13_plus (restricted)', () => { expect(ageGroupFor(1, 2011, now)).toBe('13_plus'); expect(sixteenPlus(1, 2011, now)).toBe(false); });
  it('16 next month is still 13_plus', () => { expect(ageGroupFor(11, 2010, now)).toBe('13_plus'); });
  it('16 this month is 16_plus', () => { expect(ageGroupFor(10, 2010, now)).toBe('16_plus'); });
  it('adult is 16_plus', () => { expect(ageGroupFor(5, 1990, now)).toBe('16_plus'); });
  it('only 16_plus may see mature avatars; null (signed out / offline) is restricted', () => {
    expect(canSeeMature('16_plus')).toBe(true);
    for (const g of ['13_plus', 'under_13', null, undefined, '', 'adult']) expect(canSeeMature(g)).toBe(false);
  });
});

const L: AvatarEntry[] = [
  { id: 'g-safe', race: 'goblin', gender: 'f', label: 'A' },
  { id: 'g-hot', race: 'goblin', gender: 'f', label: 'B', mature: true, safe_fallback: 'g-safe' },
  { id: 'g-hot2', race: 'goblin', gender: 'f', label: 'C', mature: true, safe_fallback: 'nope' },
  { id: 'h-hot', race: 'human', gender: 'm', label: 'D', mature: true },
  { id: 'h-safe', race: 'human', gender: 'm', label: 'E' },
];
describe('mature avatars', () => {
  it('restricted viewers never see mature avatars in the picker', () => {
    expect(visibleAvatars(L, '13_plus').map((a) => a.id)).toEqual(['g-safe', 'h-safe']);
    expect(visibleAvatars(L, null).map((a) => a.id)).toEqual(['g-safe', 'h-safe']);
    expect(visibleAvatars(L, 'under_13').map((a) => a.id)).toEqual(['g-safe', 'h-safe']);
  });
  it('16_plus sees everything', () => expect(visibleAvatars(L, '16_plus').length).toBe(5));
  it("someone else's mature pick shows as its safe fallback to a restricted viewer", () => {
    expect(avatarAsSeenBy(L, 'g-hot', '13_plus')).toBe('g-safe');
    expect(avatarAsSeenBy(L, 'g-hot', null)).toBe('g-safe');
    expect(avatarAsSeenBy(L, 'g-hot', '16_plus')).toBe('g-hot');
    expect(avatarAsSeenBy(L, 'g-safe', '13_plus')).toBe('g-safe');
  });
  it('a missing fallback falls back to the same race and gender, then to any safe avatar', () => {
    expect(avatarAsSeenBy(L, 'g-hot2', '13_plus')).toBe('g-safe');
    expect(avatarAsSeenBy(L, 'h-hot', 'under_13')).toBe('h-safe');
  });
  it('unknown ids (old card art) pass through', () => expect(avatarAsSeenBy(L, 'fizzle', '13_plus')).toBe('fizzle'));
  it('computer players only use non-mature avatars', () => expect(aiAvatars(L).every((a) => !a.mature)).toBe(true));
});
