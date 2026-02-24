/**
 * Attestation and refutation records.
 *
 * A refutation does NOT delete the original claim. It creates a normative
 * contradiction — two incompatible positions held simultaneously with
 * their authority gap as tension.
 */

import type { AlgValue, Authority } from '../types/values.js';
import { mkContra } from '../types/contra.js';
import { mkStr } from '../types/values.js';

// ── Refutation ───────────────────────────────────────────────────────

/** A refutation: an authority challenging a claim within a court scope. */
export interface Refutation {
  readonly court: string;
  readonly refuter: Authority;
  readonly target: string;
  readonly reason: AlgValue;
}

/**
 * Create a refutation.
 *
 * Does NOT require higher authority. A junior CAN refute a senior.
 * The resulting contradiction carries the authority gap as tension.
 */
export function mkRefutation(
  court: string,
  refuter: Authority,
  target: string,
  reason: AlgValue,
): Refutation {
  return { court, refuter, target, reason };
}

/**
 * Convert a refutation into a normative Contra.
 *
 * The positive side is the original claim (what is being refuted),
 * the negative side is the refuter's counter-claim.
 * Tension is derived from the authority gap (absolute value of rank difference).
 */
export function refutationToContra(
  refutation: Refutation,
  originalClaim: AlgValue,
  originalAuthority: Authority,
): AlgValue {
  // Authority gap: positive means refuter outranks, negative means dissent from below
  const gap = refutation.refuter.rank - originalAuthority.rank;
  // Tension = normalized authority gap (higher gap = higher tension)
  const tension = Math.abs(gap) / Math.max(originalAuthority.rank, refutation.refuter.rank, 1);

  return mkContra(
    originalClaim,
    refutation.reason,
    mkStr(`authority:${originalAuthority.name}`),
    mkStr(`authority:${refutation.refuter.name}`),
    tension,
    `refutation:${refutation.court}`,
  );
}
