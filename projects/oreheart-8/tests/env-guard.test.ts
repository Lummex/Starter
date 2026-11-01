import { describe, expect, it } from 'vitest';
import { buildKind, mismatch } from '../src/net/env-guard';

describe('test vs production guard', () => {
  it('a build is "test" unless it says production', () => {
    expect(buildKind('production')).toBe('production');
    expect(buildKind('test')).toBe('test');
    expect(buildKind(undefined)).toBe('test');
    expect(buildKind('prod')).toBe('test');
  });
  it('matching build and server pass', () => {
    expect(mismatch('production', 'production')).toBeNull();
    expect(mismatch('test', 'test')).toBeNull();
  });
  it('real site on the test server is refused', () => {
    expect(mismatch('production', 'test')).toMatch(/TEST server/);
  });
  it('test site on the real server is refused', () => {
    expect(mismatch('test', 'production')).toMatch(/REAL server/);
  });
  it('a server that does not answer is refused', () => {
    expect(mismatch('test', undefined)).not.toBeNull();
    expect(mismatch('production', 'something')).not.toBeNull();
  });
});
