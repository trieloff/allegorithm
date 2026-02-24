/**
 * Contradiction constructors and accessors.
 *
 * A Contra is a first-class value holding two incompatible derivations
 * together with measured tension — the information that classical logic
 * would destroy.
 */

import type { AlgValue, Contra } from './values.js';

// ── Constructor ─────────────────────────────────────────────────────

/**
 * Create a contradiction value.
 *
 * @param yes   The positive derivation.
 * @param no    The negative derivation.
 * @param whyP  Evidence for the positive side.
 * @param whyN  Evidence for the negative side.
 * @param tension  Measured tension (must be >= 0).
 * @param site  Source location where this contradiction arose.
 */
export function mkContra(
  yes: AlgValue,
  no: AlgValue,
  whyP: AlgValue,
  whyN: AlgValue,
  tension: number,
  site: string,
): Contra {
  if (tension < 0) {
    throw new RangeError(`Contra tension must be >= 0, got ${tension}`);
  }
  return { kind: 'contra', yes, no, whyP, whyN, tension, site };
}

// ── Accessors ───────────────────────────────────────────────────────

/** Get the positive derivation. */
export function contraYes(c: Contra): AlgValue {
  return c.yes;
}

/** Get the negative derivation. */
export function contraNo(c: Contra): AlgValue {
  return c.no;
}

/** Get evidence for the positive side. */
export function contraWhyP(c: Contra): AlgValue {
  return c.whyP;
}

/** Get evidence for the negative side. */
export function contraWhyN(c: Contra): AlgValue {
  return c.whyN;
}

/** Get the tension between the two sides. */
export function contraTension(c: Contra): number {
  return c.tension;
}

/** Get the site where this contradiction arose. */
export function contraSite(c: Contra): string {
  return c.site;
}

// ── Predicates ──────────────────────────────────────────────────────

/** Is this value a contradiction? */
export function isContra(v: AlgValue): v is Contra {
  return v.kind === 'contra';
}

/** Does this contradiction have high tension (> threshold)? */
export function isHighTension(c: Contra, threshold: number = 0.5): boolean {
  return c.tension > threshold;
}
