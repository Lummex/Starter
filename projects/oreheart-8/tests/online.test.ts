import { describe, it, expect } from 'vitest';
import { isOnlineEnabled } from '../src/net/switch';
describe('onlineEnabled', () => {
  it('is false without a URL', () => expect(isOnlineEnabled('', 'k', '')).toBe(false));
  it('is false without a key', () => expect(isOnlineEnabled('http://x', '', '')).toBe(false));
  it('is false with ?test=1 and no online=1', () => expect(isOnlineEnabled('http://x', 'k', '?test=1')).toBe(false));
  it('is true with ?test=1&online=1', () => expect(isOnlineEnabled('http://x', 'k', '?test=1&online=1')).toBe(true));
  it('is true for a normal visit', () => expect(isOnlineEnabled('http://x', 'k', '')).toBe(true));
});
