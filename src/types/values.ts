/**
 * Core value types for the Allegorithm language.
 *
 * Every runtime value is one of these tagged unions. The `kind` discriminant
 * lets the evaluator dispatch without instanceof checks.
 */

// ── Verdict bits (Belnap four-valued logic) ─────────────────────────
// Defined here so Verdict can reference them; full ops live in verdict.ts.

/** Neither true nor false — no information. */
export const NEITHER = 0 as const;
/** True only. */
export const TRUE = 1 as const;
/** False only. */
export const FALSE = 2 as const;
/** Both true and false — contradiction. */
export const BOTH = 3 as const;

export type VerdictBits = typeof NEITHER | typeof TRUE | typeof FALSE | typeof BOTH;

// ── Value types ─────────────────────────────────────────────────────

/** A primitive atom: number, string, or symbol. */
export interface Atom {
  readonly kind: 'atom';
  readonly value: number | string;
  /** True when this atom is a symbolic name rather than a literal. */
  readonly isSymbol: boolean;
}

/** A list of values (the fundamental compound structure). */
export interface AlgList {
  readonly kind: 'list';
  readonly items: readonly AlgValue[];
}

/** A closure capturing its lexical environment. */
export interface Closure {
  readonly kind: 'closure';
  readonly env: Environment;
  readonly params: readonly string[];
  readonly body: AlgValue;
}

/** A meaning-graph wrapper — one fable, many readings. */
export interface Fable {
  readonly kind: 'fable';
  readonly graph: unknown; // opaque until the meaning-graph module lands
}

/** A reading-record: a specific interpretation of a fable. */
export interface Reading {
  readonly kind: 'reading';
  readonly name: string;
  /** Spine: the structural backbone of the reading. */
  readonly spine: AlgValue;
  /** Map from fable nodes to reading-specific values. */
  readonly map: ReadonlyMap<string, AlgValue>;
  /** Witnesses that validate this reading. */
  readonly witnesses: readonly AlgValue[];
  /** Coherence metric for this reading. */
  readonly metric: number;
}

/** Belnap four-valued truth with evidence trail. */
export interface Verdict {
  readonly kind: 'verdict';
  /** 2-bit Belnap value: 0=Neither, 1=True, 2=False, 3=Both */
  readonly bits: VerdictBits;
  /** Evidence supporting this truth value. */
  readonly why: readonly AlgValue[];
}

/** A first-class contradiction: two incompatible derivations held together. */
export interface Contra {
  readonly kind: 'contra';
  /** The positive derivation. */
  readonly yes: AlgValue;
  /** The negative derivation. */
  readonly no: AlgValue;
  /** Evidence for the positive side. */
  readonly whyP: AlgValue;
  /** Evidence for the negative side. */
  readonly whyN: AlgValue;
  /** Measured tension between the two sides (>= 0). */
  readonly tension: number;
  /** Where in the program this contradiction arose. */
  readonly site: string;
}

/** Oracle output — provisional until witnessed or ratified. */
export interface Hypothesis {
  readonly kind: 'hypothesis';
  /** The proposed value. */
  readonly value: AlgValue;
  /** Evidence supporting the hypothesis. */
  readonly evidence: readonly AlgValue[];
  /** Witness debt: what must still be checked. */
  readonly debt: string;
}

/** The kind of authority an issuer holds. */
export type AuthorityKind = 'human' | 'llm' | 'system' | 'institution';

/** An authority that can make claims and adjudicate disputes. */
export interface Authority {
  readonly kind: 'authority';
  readonly name: string;
  readonly authorityKind: AuthorityKind;
  /** Credentials held by this authority. */
  readonly cred: readonly string[];
  /** Numeric rank within a given court (higher = more authoritative). */
  readonly rank: number;
}

/** An attestation: an authority asserting a claim within a court scope. */
export interface Attestation {
  readonly kind: 'attestation';
  readonly authority: Authority;
  /** The claim being attested. */
  readonly claim: AlgValue;
  /** The court (topic scope) within which this attestation holds. */
  readonly court: string;
}

/** A polysemous value — simultaneously holds multiple lawful readings. Not a contradiction. */
export interface Polysemous {
  readonly kind: 'polysemous';
  /** Named readings, each with a reading name and value. */
  readonly readings: readonly { readonly name: string; readonly value: AlgValue }[];
}

// ── Union type ──────────────────────────────────────────────────────

/** Every possible runtime value in Allegorithm. */
export type AlgValue =
  | Atom
  | AlgList
  | Closure
  | Fable
  | Reading
  | Verdict
  | Contra
  | Hypothesis
  | Authority
  | Attestation
  | Polysemous;

// ── Environment (for closures) ──────────────────────────────────────

/** A lexical environment: a chain of scopes mapping names to values. */
export interface Environment {
  readonly bindings: ReadonlyMap<string, AlgValue>;
  readonly parent: Environment | null;
}

// ── Constructors ────────────────────────────────────────────────────

/** Create a numeric atom. */
export function mkNum(n: number): Atom {
  return { kind: 'atom', value: n, isSymbol: false };
}

/** Create a string atom. */
export function mkStr(s: string): Atom {
  return { kind: 'atom', value: s, isSymbol: false };
}

/** Create a symbolic atom. */
export function mkSym(name: string): Atom {
  return { kind: 'atom', value: name, isSymbol: true };
}

/** Create a list value. */
export function mkList(items: readonly AlgValue[]): AlgList {
  return { kind: 'list', items };
}

/** Create a closure. */
export function mkClosure(env: Environment, params: readonly string[], body: AlgValue): Closure {
  return { kind: 'closure', env, params, body };
}

/** Create a fable (meaning graph wrapper). */
export function mkFable(graph: unknown): Fable {
  return { kind: 'fable', graph };
}

/** Create a reading. */
export function mkReading(
  name: string,
  spine: AlgValue,
  map: ReadonlyMap<string, AlgValue>,
  witnesses: readonly AlgValue[],
  metric: number,
): Reading {
  return { kind: 'reading', name, spine, map, witnesses, metric };
}

/** Create a verdict. */
export function mkVerdict(bits: VerdictBits, why: readonly AlgValue[] = []): Verdict {
  return { kind: 'verdict', bits, why };
}

/** Create a hypothesis. */
export function mkHypothesis(value: AlgValue, evidence: readonly AlgValue[], debt: string): Hypothesis {
  return { kind: 'hypothesis', value, evidence, debt };
}

/** Create an authority. */
export function mkAuthority(
  name: string,
  authorityKind: AuthorityKind,
  cred: readonly string[],
  rank: number,
): Authority {
  return { kind: 'authority', name, authorityKind, cred, rank };
}

/** Create an attestation. */
export function mkAttestation(authority: Authority, claim: AlgValue, court: string): Attestation {
  return { kind: 'attestation', authority, claim, court };
}

/** Create a polysemous value. */
export function mkPolysemous(readings: readonly { name: string; value: AlgValue }[]): Polysemous {
  return { kind: 'polysemous', readings };
}

/** Check if a value is polysemous. */
export function isPolysemous(v: AlgValue): v is Polysemous {
  return v.kind === 'polysemous';
}

/** Create an empty environment. */
export function emptyEnv(): Environment {
  return { bindings: new Map(), parent: null };
}

/** Extend an environment with new bindings. */
export function extendEnv(parent: Environment, bindings: ReadonlyMap<string, AlgValue>): Environment {
  return { bindings, parent };
}
