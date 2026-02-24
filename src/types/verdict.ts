/**
 * Belnap four-valued (paraconsistent) truth operations.
 *
 * Encoding (2-bit):
 *   bit 0 = has-True   (1)
 *   bit 1 = has-False  (2)
 *
 *   0b00 = 0 = Neither  (no information)
 *   0b01 = 1 = True
 *   0b10 = 2 = False
 *   0b11 = 3 = Both     (contradiction)
 */

import {
  type VerdictBits,
  type Verdict,
  NEITHER,
  TRUE,
  FALSE,
  BOTH,
  mkVerdict,
} from './values.js';

// ── Predicates ──────────────────────────────────────────────────────

/** Does this verdict carry the True bit? */
export function isTrue(v: Verdict): boolean {
  return (v.bits & TRUE) !== 0;
}

/** Does this verdict carry the False bit? */
export function isFalse(v: Verdict): boolean {
  return (v.bits & FALSE) !== 0;
}

/** Is this verdict Both (true AND false)? */
export function isBoth(v: Verdict): boolean {
  return v.bits === BOTH;
}

/** Is this verdict Neither (no information)? */
export function isNeither(v: Verdict): boolean {
  return v.bits === NEITHER;
}

// ── Belnap-Dunn operations ──────────────────────────────────────────

/**
 * Logical NOT in Belnap logic.
 * Swaps the True and False bits: T↔F, Both↔Both, Neither↔Neither.
 */
export function vNot(bits: VerdictBits): VerdictBits {
  const t = bits & 1;        // extract True bit
  const f = (bits >> 1) & 1; // extract False bit
  return ((t << 1) | f) as VerdictBits;
}

/**
 * Logical AND in Belnap logic.
 * - True bit is set iff both inputs have it (∧ on T-bit).
 * - False bit is set iff either input has it (∨ on F-bit).
 */
export function vAnd(a: VerdictBits, b: VerdictBits): VerdictBits {
  const tBit = (a & 1) & (b & 1);                 // AND of True bits
  const fBit = ((a >> 1) & 1) | ((b >> 1) & 1);   // OR of False bits
  return ((fBit << 1) | tBit) as VerdictBits;
}

/**
 * Logical OR in Belnap logic.
 * - True bit is set iff either input has it (∨ on T-bit).
 * - False bit is set iff both inputs have it (∧ on F-bit).
 */
export function vOr(a: VerdictBits, b: VerdictBits): VerdictBits {
  const tBit = (a & 1) | (b & 1);                 // OR of True bits
  const fBit = ((a >> 1) & 1) & ((b >> 1) & 1);   // AND of False bits
  return ((fBit << 1) | tBit) as VerdictBits;
}

// ── Bridge ──────────────────────────────────────────────────────────

/** Convert a classical boolean to a Belnap verdict. */
export function verdictFromBool(b: boolean): Verdict {
  return mkVerdict(b ? TRUE : FALSE);
}

// Re-export constants for convenience
export { NEITHER, TRUE, FALSE, BOTH };
export type { VerdictBits, Verdict };
