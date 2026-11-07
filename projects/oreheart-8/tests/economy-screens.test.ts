// Shop odds in plain words, pack art names, quest days left and collection counts (contract 4.2).
// (The deck builder's owned-count limit lives in src/ui/decks.ts, which needs a browser; AC668 checks it with a database.)
import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/engine';
import { oddsWords, packArtName, packArt, daysLeft, countLine, collectionCards } from '../src/net/quest-summary';

const STD = [ // Ken's Nov 5 layout: 3 cheap Miners, 4 Common, 2 Uncommon, 1 Rare, 1 Rare or better
  { slot_no: 0, count: 3, odds: { Common: 10000 }, pool: 'miners' },
  { slot_no: 1, count: 4, odds: { Common: 10000 } },
  { slot_no: 2, count: 2, odds: { Uncommon: 10000 } },
  { slot_no: 3, count: 1, odds: { Rare: 10000 } },
  { slot_no: 4, count: 1, odds: { Rare: 8500, 'Ultra Rare': 1300, Collector: 200 } },
];

describe('shop odds in plain words', () => {
  it('reads the default pack like the contract (Nov 5: 11 cards, the top rarity reads Legendary)', () => expect(oddsWords(STD)).toBe('11 cards: 3 Standard Miners, 4 Common, 2 Uncommon, 1 Rare, 1 Rare or better: Rare 85%, Ultra Rare 13%, Legendary 2%'));
  it('keeps slot order and odd percentages', () => expect(oddsWords([{ slot_no: 2, count: 1, odds: { Rare: 9950, Collector: 50 } }, { slot_no: 1, count: 3, odds: { Common: 10000 } }])).toBe('4 cards: 3 Common, 1 Rare or better: Rare 99.5%, Legendary 0.5%'));
});

describe('pack art', () => {
  it('maps the four pack types to Brush\'s paintings', () => {
    expect(packArtName({ id: 'standard' })).toBe('general');
    expect(packArtName({ id: 'goblin' })).toBe('goblin');
    expect(packArtName({ id: 'gnome' })).toBe('gnome');
    expect(packArtName({ id: 'dwarf' })).toBe('dwarf');
    expect(packArtName({ id: 'new-thing', faction: 'dwarves' })).toBe('dwarf');
    expect(packArtName({ id: 'x', art: '/art/packs/pack-gnome.webp' })).toBe('gnome');
    expect(packArt({ id: 'standard' }, '-top')).toBe('/art/packs/pack-general-top.webp');
  });
});

describe('quest days left', () => {
  it('counts whole days', () => {
    expect(daysLeft('2026-11-05', '2026-11-02')).toBe('3 days left');
    expect(daysLeft('2026-11-03', '2026-11-02')).toBe('1 day left');
    expect(daysLeft('2026-11-02', '2026-11-02')).toBe('Ends today');
  });
});

describe('collection', () => {
  it('lists every card that is not switched off', () => {
    expect(collectionCards().length).toBe(Object.values(CARDS).filter((c: any) => !c.disabled).length + 3); // + the three pack Commanders (Nov 5)
    expect(collectionCards().some((c: any) => c.disabled)).toBe(false);
  });
  it('counts copies and different cards (Nov 5: crystals and Commanders are owned cards like any other)', () => {
    const a = collectionCards().find((c: any) => c.type === 'creature')!, b = collectionCards().filter((c: any) => c.type === 'creature')[1];
    expect(collectionCards().filter((c: any) => c.type === 'commander').length).toBe(3);
    expect(countLine({ [a.id]: 4, [b.id]: 1 }, collectionCards())).toBe(`You own 5 cards (2 of ${collectionCards().length} different)`);
  });
});

