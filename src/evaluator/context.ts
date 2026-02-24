/**
 * Evaluation context — the runtime state threaded through every eval call.
 */

import type { Environment, Reading, AlgValue } from '../types/index.js';
import type { Court } from '../types/authority.js';
import { emptyEnv } from '../types/index.js';

/** Placeholder for the evidence database — filled in by the evidence system agent. */
export interface EvidenceDB {
  /** Look up evidence for a proposition. */
  lookup?(prop: AlgValue): AlgValue[];
}

/** The evaluation context threaded through every eval call. */
export interface EvalContext {
  env: Environment;
  readings: Reading[];
  facts: EvidenceDB;
  court: Court | null;
  oracle: ((req: any) => Promise<any>) | null;
  options: Record<string, any>;
}

/** Create a fresh evaluation context. */
export function mkContext(overrides: Partial<EvalContext> = {}): EvalContext {
  return {
    env: overrides.env ?? emptyEnv(),
    readings: overrides.readings ?? [],
    facts: overrides.facts ?? {},
    court: overrides.court ?? null,
    oracle: overrides.oracle ?? null,
    options: overrides.options ?? {},
  };
}
