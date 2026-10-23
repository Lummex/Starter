import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/engine/content';
describe('round 12c step 2', () => {
  it('per-card ranges and spell numbers', () => {
    const r = (id: string) => (CARDS as any)[id].range;
    expect([r('goblin-slinger'), r('spark-gnome'), r('gyrocopter-ace'), r('deepforge-crossbowman'), r('axe-thrower')]).toEqual([6, 5, 2, 7, 5]);
    expect(r('hexwright-apprentice')).toBeGreaterThanOrEqual(13);
    expect((CARDS as any)['meteor-strike'].params.amount).toBe(4);
    expect((CARDS as any)['venom-shiv'].params.turns).toBe(7);
  });
});
