import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

describe('owner art (Round 7)', () => {
  it('card back is the owner 1184x1664 single card', async () => {
    const m = await sharp('public/art/ui/oreheart-card-back.webp').metadata();
    expect([m.width, m.height]).toEqual([1184, 1664]);
  });
  it('deck pile is the owner transparent 1155x1313 PNG and Deck_image is gone', async () => {
    const m = await sharp('public/art/deck/deck-pile.png').metadata();
    expect([m.width, m.height, m.hasAlpha]).toEqual([1155, 1313, true]);
    const { data } = await sharp('public/art/deck/deck-pile.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    await expect(sharp('public/art/deck/deck-image.webp').metadata()).rejects.toThrow();
  });
});
