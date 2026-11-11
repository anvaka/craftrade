import * as node from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as shim from '../src/client/local/shims/crypto.ts';

describe('the browser stand-in for node:crypto', () => {
  const samples = ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000), 'timber é 🙂'];
  it('hashes like Node', () => {
    for (const s of samples) {
      expect(shim.createHash('sha256').update(s).digest('hex')).toBe(node.createHash('sha256').update(s).digest('hex'));
      expect(shim.createHash('sha256').update(s).digest('base64url')).toBe(node.createHash('sha256').update(s).digest('base64url'));
    }
  });
  it('signs like Node, with short and long keys', () => {
    for (const key of ['k', 'a secret', 'k'.repeat(100)]) {
      for (const s of samples) {
        expect(shim.createHmac('sha256', key).update(s).digest('hex')).toBe(node.createHmac('sha256', key).update(s).digest('hex'));
        expect(shim.createHmac('sha256', key).update(s).digest().readUInt32BE(0)).toBe(node.createHmac('sha256', key).update(s).digest().readUInt32BE(0));
      }
    }
  });
  it('draws random bytes and integers inside their range', () => {
    expect(shim.randomBytes(32).toString('base64url')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = shim.randomInt(100, 110);
      expect(v).toBeGreaterThanOrEqual(100);
      expect(v).toBeLessThan(110);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
    expect(shim.randomInt(1)).toBe(0);
  });
});
