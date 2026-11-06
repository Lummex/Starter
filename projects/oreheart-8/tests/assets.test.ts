import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

describe('owner art (Round 7)', () => {
  it('card back is the owner single card (new picture Oct 24, 1024x1536 after the size shrink)', async () => {
    const m = await sharp('public/art/ui/oreheart-card-back.webp').metadata();
    expect([m.width, m.height]).toEqual([1024, 1536]);
  });
  it('deck pile is the owner transparent PNG (new picture Oct 24, 900x999 after the size shrink) and Deck_image is gone', async () => {
    const m = await sharp('public/art/deck/deck-menu-deck-pile.png').metadata();
    expect([m.width, m.height, m.hasAlpha]).toEqual([900, 999, true]);
    const { data } = await sharp('public/art/deck/deck-menu-deck-pile.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
    await expect(sharp('public/art/deck/deck-image.webp').metadata()).rejects.toThrow();
  });
});
