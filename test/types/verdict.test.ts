import { describe, it, expect } from 'vitest';
import {
  vNot, vAnd, vOr,
  isTrue, isFalse, isBoth, isNeither,
  verdictFromBool,
  NEITHER, TRUE, FALSE, BOTH,
  mkVerdict,
} from '../../src/types/index.js';
import type { VerdictBits } from '../../src/types/index.js';

// Helper to name bits
const name = (b: VerdictBits): string =>
  ({ [NEITHER]: 'N', [TRUE]: 'T', [FALSE]: 'F', [BOTH]: 'B' })[b];

describe('vNot', () => {
  it.each([
    [NEITHER, NEITHER],  // Neither → Neither
    [TRUE, FALSE],       // True → False
    [FALSE, TRUE],       // False → True
    [BOTH, BOTH],        // Both → Both
  ] as [VerdictBits, VerdictBits][])('vNot(%s) = %s', (input, expected) => {
    expect(vNot(input)).toBe(expected);
  });
});

describe('vAnd (all 16 combinations)', () => {
  // Truth table for Belnap AND:
  //        N    T    F    B
  //   N    N    N    F    F
  //   T    N    T    F    B
  //   F    F    F    F    F
  //   B    F    B    F    B
  const table: [VerdictBits, VerdictBits, VerdictBits][] = [
    // a=NEITHER
    [NEITHER, NEITHER, NEITHER],
    [NEITHER, TRUE,    NEITHER],
    [NEITHER, FALSE,   FALSE],
    [NEITHER, BOTH,    FALSE],
    // a=TRUE
    [TRUE, NEITHER, NEITHER],
    [TRUE, TRUE,    TRUE],
    [TRUE, FALSE,   FALSE],
    [TRUE, BOTH,    BOTH],
    // a=FALSE
    [FALSE, NEITHER, FALSE],
    [FALSE, TRUE,    FALSE],
    [FALSE, FALSE,   FALSE],
    [FALSE, BOTH,    FALSE],
    // a=BOTH
    [BOTH, NEITHER, FALSE],
    [BOTH, TRUE,    BOTH],
    [BOTH, FALSE,   FALSE],
    [BOTH, BOTH,    BOTH],
  ];

  it.each(table)('vAnd(%s, %s) = %s', (a, b, expected) => {
    expect(vAnd(a, b)).toBe(expected);
  });
});

describe('vOr (all 16 combinations)', () => {
  // Truth table for Belnap OR:
  //        N    T    F    B
  //   N    N    T    N    T
  //   T    T    T    T    T
  //   F    N    T    F    B
  //   B    T    T    B    B
  const table: [VerdictBits, VerdictBits, VerdictBits][] = [
    // a=NEITHER
    [NEITHER, NEITHER, NEITHER],
    [NEITHER, TRUE,    TRUE],
    [NEITHER, FALSE,   NEITHER],
    [NEITHER, BOTH,    TRUE],
    // a=TRUE
    [TRUE, NEITHER, TRUE],
    [TRUE, TRUE,    TRUE],
    [TRUE, FALSE,   TRUE],
    [TRUE, BOTH,    TRUE],
    // a=FALSE
    [FALSE, NEITHER, NEITHER],
    [FALSE, TRUE,    TRUE],
    [FALSE, FALSE,   FALSE],
    [FALSE, BOTH,    BOTH],
    // a=BOTH
    [BOTH, NEITHER, TRUE],
    [BOTH, TRUE,    TRUE],
    [BOTH, FALSE,   BOTH],
    [BOTH, BOTH,    BOTH],
  ];

  it.each(table)('vOr(%s, %s) = %s', (a, b, expected) => {
    expect(vOr(a, b)).toBe(expected);
  });
});

describe('predicates', () => {
  it('isTrue detects True bit', () => {
    expect(isTrue(mkVerdict(TRUE))).toBe(true);
    expect(isTrue(mkVerdict(BOTH))).toBe(true);
    expect(isTrue(mkVerdict(FALSE))).toBe(false);
    expect(isTrue(mkVerdict(NEITHER))).toBe(false);
  });

  it('isFalse detects False bit', () => {
    expect(isFalse(mkVerdict(FALSE))).toBe(true);
    expect(isFalse(mkVerdict(BOTH))).toBe(true);
    expect(isFalse(mkVerdict(TRUE))).toBe(false);
    expect(isFalse(mkVerdict(NEITHER))).toBe(false);
  });

  it('isBoth is true only for Both', () => {
    expect(isBoth(mkVerdict(BOTH))).toBe(true);
    expect(isBoth(mkVerdict(TRUE))).toBe(false);
    expect(isBoth(mkVerdict(FALSE))).toBe(false);
    expect(isBoth(mkVerdict(NEITHER))).toBe(false);
  });

  it('isNeither is true only for Neither', () => {
    expect(isNeither(mkVerdict(NEITHER))).toBe(true);
    expect(isNeither(mkVerdict(TRUE))).toBe(false);
    expect(isNeither(mkVerdict(FALSE))).toBe(false);
    expect(isNeither(mkVerdict(BOTH))).toBe(false);
  });
});

describe('verdictFromBool', () => {
  it('true → True verdict', () => {
    const v = verdictFromBool(true);
    expect(v.bits).toBe(TRUE);
    expect(isTrue(v)).toBe(true);
    expect(isFalse(v)).toBe(false);
  });

  it('false → False verdict', () => {
    const v = verdictFromBool(false);
    expect(v.bits).toBe(FALSE);
    expect(isFalse(v)).toBe(true);
    expect(isTrue(v)).toBe(false);
  });
});

describe('algebraic properties', () => {
  const all: VerdictBits[] = [NEITHER, TRUE, FALSE, BOTH];

  it('vAnd is commutative', () => {
    for (const a of all)
      for (const b of all)
        expect(vAnd(a, b)).toBe(vAnd(b, a));
  });

  it('vOr is commutative', () => {
    for (const a of all)
      for (const b of all)
        expect(vOr(a, b)).toBe(vOr(b, a));
  });

  it('double negation is identity', () => {
    for (const a of all)
      expect(vNot(vNot(a))).toBe(a);
  });

  it('De Morgan: vNot(vAnd(a,b)) = vOr(vNot(a), vNot(b))', () => {
    for (const a of all)
      for (const b of all)
        expect(vNot(vAnd(a, b))).toBe(vOr(vNot(a), vNot(b)));
  });
});
