/**
 * Public API for the Allegorithm type system.
 */

// ── Value types and constructors ────────────────────────────────────
export {
  // Constants
  NEITHER, TRUE, FALSE, BOTH,

  // Types
  type VerdictBits,
  type AlgValue,
  type Atom,
  type AlgList,
  type Closure,
  type Fable,
  type Reading,
  type Verdict,
  type Contra,
  type Hypothesis,
  type Authority,
  type AuthorityKind,
  type Attestation,
  type Environment,

  // Constructors
  mkNum, mkStr, mkSym, mkList,
  mkClosure, mkFable, mkReading,
  mkVerdict, mkHypothesis,
  mkAuthority, mkAttestation,
  emptyEnv, extendEnv,
} from './values.js';

// ── Belnap truth operations ─────────────────────────────────────────
export {
  vNot, vAnd, vOr,
  isTrue, isFalse, isBoth, isNeither,
  verdictFromBool,
} from './verdict.js';

// ── Contradiction operations ────────────────────────────────────────
export {
  mkContra,
  contraYes, contraNo,
  contraWhyP, contraWhyN,
  contraTension, contraSite,
  isContra, isHighTension,
} from './contra.js';

// ── Authority and court operations ──────────────────────────────────
export {
  type Court,
  mkCourt,
  effectiveRank,
  dominates, clearlyDominates,
} from './authority.js';
