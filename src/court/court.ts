/**
 * Full court adjudication engine.
 *
 * A court collects stances (authority + claim + evidence), applies a
 * policy to project them into a binding value, and preserves dissent
 * as first-class contradiction.
 */

import type { AlgValue, Authority, Attestation } from '../types/values.js';
import type { Court } from '../types/authority.js';
import { effectiveRank, dominates } from '../types/authority.js';
import { mkContra } from '../types/contra.js';
import { mkStr, mkNum, mkList } from '../types/values.js';

// ── Types ────────────────────────────────────────────────────────────

/** Court policy for projecting contradictory stances into a binding. */
export type CourtPolicy =
  | 'max-authority'
  | 'weighted-confidence'
  | 'min-tension'
  | 'unanimous-or-contra';

/** A stance: an authority's claim with supporting evidence. */
export interface Stance {
  readonly value: AlgValue;
  readonly issuer: Authority;
  readonly evidence: readonly AlgValue[];
  readonly attestation?: Attestation;
}

/** The result of adjudication: a binding value, possible dissent, and confidence. */
export interface AdjudicationResult {
  readonly binding: AlgValue;
  readonly dissent: AlgValue | null;
  readonly confidence: number;
}

/**
 * A full court: extends the base Court with policy and threshold.
 *
 * The base Court (from types/authority.ts) provides topic and dominanceRules.
 * FullCourt adds the adjudication policy.
 */
export interface FullCourt extends Court {
  readonly name: string;
  readonly scope: string;
  readonly policy: CourtPolicy;
  readonly threshold: number;
}

// ── Constructor ──────────────────────────────────────────────────────

/** Create a full court. */
export function mkFullCourt(
  name: string,
  scope: string,
  dominanceRules: ReadonlyMap<string, number>,
  policy: CourtPolicy = 'max-authority',
  threshold: number = 0.7,
): FullCourt {
  return { name, scope, topic: scope, dominanceRules, policy, threshold };
}

// ── Adjudication ─────────────────────────────────────────────────────

/**
 * Adjudicate stances through a court's policy.
 *
 * Returns {binding, dissent, confidence} where:
 * - binding is the selected canonical value
 * - dissent is a Contra holding overruled stances (or null if unanimous)
 * - confidence is [0,1] reflecting how strong the adjudication is
 */
export function adjudicate(court: FullCourt, stances: Stance[]): AdjudicationResult {
  if (stances.length === 0) {
    return { binding: mkStr('no-stances'), dissent: null, confidence: 0 };
  }
  if (stances.length === 1) {
    return { binding: stances[0].value, dissent: null, confidence: 1.0 };
  }

  switch (court.policy) {
    case 'max-authority':
      return adjudicateMaxAuthority(court, stances);
    case 'weighted-confidence':
      return adjudicateWeightedConfidence(court, stances);
    case 'min-tension':
      return adjudicateMinTension(court, stances);
    case 'unanimous-or-contra':
      return adjudicateUnanimous(court, stances);
  }
}

/**
 * Canon: project a claim through court policy.
 *
 * Filters stances relevant to the claim, then adjudicates.
 */
export function canon(
  court: FullCourt,
  claim: string,
  stances: Stance[],
): AdjudicationResult {
  return adjudicate(court, stances);
}

/**
 * Adjudicate across multiple courts with overlapping jurisdiction.
 *
 * Each court produces its own AdjudicationResult. If they disagree,
 * the result is a Contra of Contras — institutional conflict as data.
 */
export function multiCourtAdjudicate(
  courts: FullCourt[],
  stances: Stance[],
): AdjudicationResult {
  if (courts.length === 0) {
    return { binding: mkStr('no-courts'), dissent: null, confidence: 0 };
  }
  if (courts.length === 1) {
    return adjudicate(courts[0], stances);
  }

  const results = courts.map(c => adjudicate(c, stances));

  // Check if all courts agree on the binding
  const first = results[0];
  const allAgree = results.every(r => valuesEqual(r.binding, first.binding));

  if (allAgree) {
    // Average confidence
    const avgConf = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    return { binding: first.binding, dissent: first.dissent, confidence: avgConf };
  }

  // Courts disagree → Contra of Contras
  // Use first court's binding as the "yes" side, second as "no"
  const yesResult = results[0];
  const noResult = results[1];
  const contraOfContras = mkContra(
    yesResult.binding,
    noResult.binding,
    mkStr(`court:${courts[0].name}`),
    mkStr(`court:${courts[1].name}`),
    Math.abs(yesResult.confidence - noResult.confidence),
    'multi-court-conflict',
  );

  // For >2 courts, nest remaining disagreements
  let combined: AlgValue = contraOfContras;
  for (let i = 2; i < results.length; i++) {
    if (!valuesEqual(results[i].binding, yesResult.binding)) {
      combined = mkContra(
        combined,
        results[i].binding,
        mkStr('accumulated-courts'),
        mkStr(`court:${courts[i].name}`),
        0.5,
        'multi-court-conflict',
      );
    }
  }

  const avgConf = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  return { binding: combined, dissent: null, confidence: avgConf };
}

// ── Policy implementations ───────────────────────────────────────────

/** :max-authority — binding = stance from highest effective rank. */
function adjudicateMaxAuthority(court: FullCourt, stances: Stance[]): AdjudicationResult {
  // Sort by effective rank descending
  const ranked = stances
    .map(s => ({ stance: s, rank: effectiveRank(s.issuer, court) }))
    .sort((a, b) => b.rank - a.rank);

  const best = ranked[0];
  const second = ranked[1];

  // Compute dominance degree between top two
  const degree = dominates(best.stance.issuer, second.stance.issuer, court);

  if (degree > court.threshold) {
    // Clear dominance: binding = best, dissent = rest as Contra
    const dissent = buildDissent(ranked.slice(1).map(r => r.stance), court);
    return {
      binding: best.stance.value,
      dissent,
      confidence: degree,
    };
  }

  // No clear dominance — return Contra
  const contra = mkContra(
    best.stance.value,
    second.stance.value,
    mkStr(`authority:${best.stance.issuer.name}`),
    mkStr(`authority:${second.stance.issuer.name}`),
    1.0 - degree, // tension = closeness of ranks
    `court:${court.name}`,
  );
  return { binding: contra, dissent: null, confidence: degree };
}

/**
 * :weighted-confidence — weight each stance by (effective rank × evidence count).
 * If weights are close (within threshold), return Contra.
 * This is where a junior with strong evidence can challenge a senior.
 */
function adjudicateWeightedConfidence(court: FullCourt, stances: Stance[]): AdjudicationResult {
  const weighted = stances.map(s => ({
    stance: s,
    weight: effectiveRank(s.issuer, court) * Math.max(1, s.evidence.length),
  }));

  weighted.sort((a, b) => b.weight - a.weight);

  const best = weighted[0];
  const second = weighted[1];
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);

  // Confidence is the proportion of weight held by the best stance
  const confidence = totalWeight > 0 ? best.weight / totalWeight : 0.5;

  // If the gap between best and second is within threshold, it's ambiguous
  const gap = totalWeight > 0
    ? (best.weight - second.weight) / totalWeight
    : 0;

  if (gap < (1 - court.threshold)) {
    // Close contest — return Contra showing the tension
    const contra = mkContra(
      best.stance.value,
      second.stance.value,
      mkList(best.stance.evidence.slice()),
      mkList(second.stance.evidence.slice()),
      1.0 - gap, // higher tension when closer
      `court:${court.name}`,
    );
    return { binding: contra, dissent: null, confidence };
  }

  // Clear winner
  const dissent = buildDissent(weighted.slice(1).map(w => w.stance), court);
  return { binding: best.stance.value, dissent, confidence };
}

/** :min-tension — stub: picks the first stance, low confidence. */
function adjudicateMinTension(court: FullCourt, stances: Stance[]): AdjudicationResult {
  // Stub: just pick the first stance with low confidence
  const dissent = buildDissent(stances.slice(1), court);
  return {
    binding: stances[0].value,
    dissent,
    confidence: 0.3,
  };
}

/** :unanimous-or-contra — if all stances agree, return value. Otherwise, Contra. */
function adjudicateUnanimous(court: FullCourt, stances: Stance[]): AdjudicationResult {
  const first = stances[0];
  const allAgree = stances.every(s => valuesEqual(s.value, first.value));

  if (allAgree) {
    return { binding: first.value, dissent: null, confidence: 1.0 };
  }

  // Disagreement → Contra
  const dissenters = stances.filter(s => !valuesEqual(s.value, first.value));
  const contra = mkContra(
    first.value,
    dissenters[0].value,
    mkStr(`authority:${first.issuer.name}`),
    mkStr(`authority:${dissenters[0].issuer.name}`),
    dissenters.length / stances.length, // tension proportional to dissent
    `court:${court.name}`,
  );
  return { binding: contra, dissent: null, confidence: 1.0 / stances.length };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a Contra chain from dissenting stances. */
function buildDissent(stances: Stance[], court: FullCourt): AlgValue | null {
  if (stances.length === 0) return null;
  if (stances.length === 1) {
    return mkContra(
      stances[0].value,
      mkStr('overruled'),
      mkStr(`authority:${stances[0].issuer.name}`),
      mkStr('court-decision'),
      0.5,
      `court:${court.name}`,
    );
  }

  // Chain dissents
  let result: AlgValue = stances[0].value;
  for (let i = 1; i < stances.length; i++) {
    result = mkContra(
      result,
      stances[i].value,
      mkStr(`authority:${stances[i - 1 >= 1 ? i - 1 : 0].issuer.name}`),
      mkStr(`authority:${stances[i].issuer.name}`),
      0.3,
      `court:${court.name}`,
    );
  }
  return mkContra(
    result,
    mkStr('overruled'),
    mkStr('dissent'),
    mkStr('court-decision'),
    0.5,
    `court:${court.name}`,
  );
}

/** Shallow structural equality for AlgValues. */
function valuesEqual(a: AlgValue, b: AlgValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'atom' && b.kind === 'atom') {
    return a.value === b.value && a.isSymbol === b.isSymbol;
  }
  // For other kinds, reference equality is the fallback
  return a === b;
}
