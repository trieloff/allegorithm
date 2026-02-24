/**
 * Evidence database — accumulates support and refutation for claims.
 *
 * The EvidenceDB is immutable: every mutation returns a new copy.
 * Verdicts are computed from Belnap four-valued logic:
 *   TRUE if any support, FALSE if any refutation,
 *   BOTH if both exist, NEITHER if no evidence at all.
 */

import type { AlgValue, Verdict, VerdictBits } from '../types/index.js';
import { mkVerdict, NEITHER, TRUE, FALSE, BOTH } from '../types/index.js';

// ── Types ───────────────────────────────────────────────────────────

export interface EvidenceEntry {
  readonly claim: string;
  readonly support: readonly AlgValue[];
  readonly refutation: readonly AlgValue[];
}

export interface EvidenceDB {
  readonly entries: ReadonlyMap<string, EvidenceEntry>;
}

// ── Constructor ─────────────────────────────────────────────────────

/** Create an empty evidence database. */
export function mkEvidenceDB(): EvidenceDB {
  return { entries: new Map() };
}

// ── Mutations (immutable — return new DB) ───────────────────────────

/** Add supporting evidence for a claim. Never removes refutation. */
export function affirm(db: EvidenceDB, claim: string, evidence: AlgValue): EvidenceDB {
  const existing = db.entries.get(claim);
  const entry: EvidenceEntry = existing
    ? { claim, support: [...existing.support, evidence], refutation: existing.refutation }
    : { claim, support: [evidence], refutation: [] };

  const entries = new Map(db.entries);
  entries.set(claim, entry);
  return { entries };
}

/** Add refuting evidence for a claim. Never removes support. */
export function deny(db: EvidenceDB, claim: string, evidence: AlgValue): EvidenceDB {
  const existing = db.entries.get(claim);
  const entry: EvidenceEntry = existing
    ? { claim, support: existing.support, refutation: [...existing.refutation, evidence] }
    : { claim, support: [], refutation: [evidence] };

  const entries = new Map(db.entries);
  entries.set(claim, entry);
  return { entries };
}

// ── Query ───────────────────────────────────────────────────────────

/** Compute a Belnap verdict for a claim based on accumulated evidence. */
export function queryClaim(db: EvidenceDB, claim: string): Verdict {
  const entry = db.entries.get(claim);
  if (!entry) return mkVerdict(NEITHER);

  const hasSupport = entry.support.length > 0;
  const hasRefutation = entry.refutation.length > 0;

  let bits: VerdictBits;
  if (hasSupport && hasRefutation) bits = BOTH;
  else if (hasSupport) bits = TRUE;
  else if (hasRefutation) bits = FALSE;
  else bits = NEITHER;

  const why: AlgValue[] = [...entry.support, ...entry.refutation];
  return mkVerdict(bits, why);
}

/** Get the evidence entry for a claim, or undefined if none. */
export function getEntry(db: EvidenceDB, claim: string): EvidenceEntry | undefined {
  return db.entries.get(claim);
}
