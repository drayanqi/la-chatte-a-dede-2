import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../seededRandom.js';

/** Independent reference implementation of mulberry32 (public domain, bryc). */
function referenceMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('SeededRandom (mulberry32)', () => {
  it('matches the reference mulberry32 implementation', () => {
    for (const seed of [0, 1, 12345, 4294967295, 987654321]) {
      const rng = new SeededRandom(seed);
      const ref = referenceMulberry32(seed);
      for (let i = 0; i < 1000; i++) {
        expect(rng.next()).toBe(ref());
      }
    }
  });

  it('produces identical sequences for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('next() values stay in [0, 1)', () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 10000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() stays within [min, max)', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 10000; i++) {
      const v = rng.range(-3.5, 7.25);
      expect(v).toBeGreaterThanOrEqual(-3.5);
      expect(v).toBeLessThan(7.25);
    }
  });

  it('range() returns min when the underlying draw is 0 for a degenerate interval', () => {
    const rng = new SeededRandom(5);
    expect(rng.range(2, 2)).toBe(2);
  });

  it('shuffle() is deterministic for the same seed', () => {
    const a = new SeededRandom(123).shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const b = new SeededRandom(123).shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(a).toEqual(b);
  });

  it('shuffle() preserves the multiset of elements', () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const output = new SeededRandom(2024).shuffle(input);
    expect([...output].sort((x, y) => x - y)).toEqual([...input].sort((x, y) => x - y));
  });

  it('shuffle() does not mutate the input array', () => {
    const input = [1, 2, 3, 4, 5];
    new SeededRandom(11).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });

  it('shuffle() handles empty and single-element arrays', () => {
    expect(new SeededRandom(3).shuffle([])).toEqual([]);
    expect(new SeededRandom(3).shuffle([42])).toEqual([42]);
  });
});
