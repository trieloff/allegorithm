/**
 * Authority, attestation, and court-scoped dominance.
 *
 * Authority is a partial order scoped by topic. A security lead outranks
 * an engineer on threat models but has no jurisdiction over UX. The
 * `dominates` function returns a degree in [0, 1], NOT a boolean:
 *   1.0  = clearly dominates
 *   0.0  = clearly subordinate
 *   0.5  = incomparable (no jurisdiction)
 */

import type { Authority, Attestation, AlgValue } from './values.js';
export type { Authority, Attestation };

// ── Court (topic scope) ─────────────────────────────────────────────

/**
 * A court defines a topic scope and how authority is compared within it.
 *
 * The `dominanceRules` map credentials to their weight within this court.
 * An authority's effective rank in a court is its base rank multiplied by
 * the sum of weights for credentials it holds that the court recognises.
 */
export interface Court {
  readonly topic: string;
  /** Map from credential name to weight within this court. */
  readonly dominanceRules: ReadonlyMap<string, number>;
}

// ── Constructors ────────────────────────────────────────────────────

/** Create a court (topic scope). */
export function mkCourt(topic: string, dominanceRules: ReadonlyMap<string, number>): Court {
  return { topic, dominanceRules };
}

// ── Dominance ───────────────────────────────────────────────────────

/**
 * Compute the effective rank of an authority within a court.
 *
 * The effective rank is the authority's base rank scaled by the sum of
 * weights for credentials recognised by the court.  If the authority
 * holds no recognised credentials, the effective rank is 0.
 */
export function effectiveRank(auth: Authority, court: Court): number {
  let credWeight = 0;
  for (const c of auth.cred) {
    const w = court.dominanceRules.get(c);
    if (w !== undefined) {
      credWeight += w;
    }
  }
  return auth.rank * credWeight;
}

/**
 * Does authority `a` dominate authority `b` within a given court?
 *
 * Returns a degree in [0, 1]:
 *   - 1.0  = `a` clearly dominates `b`
 *   - 0.0  = `b` clearly dominates `a`
 *   - 0.5  = incomparable (neither has jurisdiction, or equal)
 *
 * The degree is derived from the ratio of effective ranks, mapped to
 * [0, 1] via  degree = rankA / (rankA + rankB).  When both are 0
 * (neither has credentials in this court), the result is 0.5.
 */
export function dominates(a: Authority, b: Authority, court: Court): number {
  const rankA = effectiveRank(a, court);
  const rankB = effectiveRank(b, court);

  // Neither has jurisdiction
  if (rankA === 0 && rankB === 0) {
    return 0.5;
  }

  return rankA / (rankA + rankB);
}

/**
 * Does authority `a` clearly dominate `b` (degree > threshold)?
 *
 * A convenience wrapper returning boolean for contexts that need
 * a binary decision, but callers should prefer the raw degree.
 */
export function clearlyDominates(
  a: Authority,
  b: Authority,
  court: Court,
  threshold: number = 0.7,
): boolean {
  return dominates(a, b, court) > threshold;
}
