import { describe, it, expect } from 'vitest';
import {
  mkContra,
  contraYes, contraNo,
  contraWhyP, contraWhyN,
  contraTension, contraSite,
  isContra, isHighTension,
  mkNum, mkStr, mkSym,
} from '../../src/types/index.js';

describe('mkContra', () => {
  it('constructs a contradiction with all fields', () => {
    const yes = mkNum(1);
    const no = mkNum(0);
    const whyP = mkStr('affirmed by Alice');
    const whyN = mkStr('denied by Bob');
    const c = mkContra(yes, no, whyP, whyN, 0.8, 'line:42');

    expect(c.kind).toBe('contra');
    expect(contraYes(c)).toBe(yes);
    expect(contraNo(c)).toBe(no);
    expect(contraWhyP(c)).toBe(whyP);
    expect(contraWhyN(c)).toBe(whyN);
    expect(contraTension(c)).toBe(0.8);
    expect(contraSite(c)).toBe('line:42');
  });

  it('allows zero tension', () => {
    const c = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0, 'test');
    expect(contraTension(c)).toBe(0);
  });

  it('rejects negative tension', () => {
    expect(() =>
      mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), -0.1, 'test'),
    ).toThrow(RangeError);
  });
});

describe('isContra', () => {
  it('returns true for Contra values', () => {
    const c = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0.5, 'test');
    expect(isContra(c)).toBe(true);
  });

  it('returns false for non-Contra values', () => {
    expect(isContra(mkNum(42))).toBe(false);
    expect(isContra(mkStr('hello'))).toBe(false);
    expect(isContra(mkSym('x'))).toBe(false);
  });
});

describe('isHighTension', () => {
  it('uses default threshold of 0.5', () => {
    const low = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0.3, 'test');
    const high = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0.9, 'test');

    expect(isHighTension(low)).toBe(false);
    expect(isHighTension(high)).toBe(true);
  });

  it('respects custom threshold', () => {
    const c = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0.3, 'test');
    expect(isHighTension(c, 0.2)).toBe(true);
    expect(isHighTension(c, 0.5)).toBe(false);
  });

  it('tension exactly at threshold is not high', () => {
    const c = mkContra(mkNum(1), mkNum(0), mkStr('a'), mkStr('b'), 0.5, 'test');
    expect(isHighTension(c, 0.5)).toBe(false);
  });
});
