/**
 * Built-in functions available in every Allegorithm environment.
 */

import type { AlgValue, Atom, AlgList } from '../types/index.js';
import {
  mkNum, mkStr, mkSym, mkList,
  mkVerdict, TRUE, FALSE, BOTH, NEITHER,
  isTrue, isFalse, isBoth, isNeither,
  vNot, vAnd, vOr,
} from '../types/index.js';
import {
  isContra, contraYes, contraNo, contraTension, contraSite, isHighTension,
} from '../types/contra.js';
import { printValue as formatValue } from '../printer/printer.js';

/** A built-in function: receives evaluated arguments, returns a value. */
export type BuiltinFn = (args: AlgValue[]) => AlgValue;

/** Registry of all built-in functions. */
const builtins = new Map<string, BuiltinFn>();

function register(name: string, fn: BuiltinFn): void {
  builtins.set(name, fn);
}

/** Get a built-in by name. */
export function getBuiltin(name: string): BuiltinFn | undefined {
  return builtins.get(name);
}

/** Get the full prelude environment bindings. */
export function preludeBindings(): Map<string, AlgValue> {
  const bindings = new Map<string, AlgValue>();
  // Also bind true, false, nil as values
  bindings.set('true', mkVerdict(TRUE));
  bindings.set('false', mkVerdict(FALSE));
  bindings.set('nil', mkSym('nil'));
  bindings.set('both-verdict', mkVerdict(BOTH));
  bindings.set('neither-verdict', mkVerdict(NEITHER));
  return bindings;
}

// ── Helpers ──────────────────────────────────────────────────────────

function expectNum(v: AlgValue, ctx: string): number {
  if (v.kind !== 'atom' || typeof v.value !== 'number') {
    throw new Error(`${ctx}: expected number, got ${v.kind}`);
  }
  return v.value;
}

function boolToVerdict(b: boolean): AlgValue {
  return mkVerdict(b ? TRUE : FALSE);
}

// ── Arithmetic ───────────────────────────────────────────────────────

register('+', (args) => {
  return mkNum(args.reduce((acc, v) => acc + expectNum(v, '+'), 0));
});

register('-', (args) => {
  if (args.length === 0) throw new Error('-: requires at least 1 argument');
  if (args.length === 1) return mkNum(-expectNum(args[0], '-'));
  const first = expectNum(args[0], '-');
  return mkNum(args.slice(1).reduce((acc, v) => acc - expectNum(v, '-'), first));
});

register('*', (args) => {
  return mkNum(args.reduce((acc, v) => acc * expectNum(v, '*'), 1));
});

register('/', (args) => {
  if (args.length !== 2) throw new Error('/: requires exactly 2 arguments');
  const b = expectNum(args[1], '/');
  if (b === 0) throw new Error('/: division by zero');
  return mkNum(expectNum(args[0], '/') / b);
});

register('mod', (args) => {
  if (args.length !== 2) throw new Error('mod: requires exactly 2 arguments');
  return mkNum(expectNum(args[0], 'mod') % expectNum(args[1], 'mod'));
});

// ── Comparison ───────────────────────────────────────────────────────

register('=', (args) => {
  if (args.length !== 2) throw new Error('=: requires exactly 2 arguments');
  return boolToVerdict(algEqual(args[0], args[1]));
});

register('<', (args) => {
  if (args.length !== 2) throw new Error('<: requires exactly 2 arguments');
  return boolToVerdict(expectNum(args[0], '<') < expectNum(args[1], '<'));
});

register('>', (args) => {
  if (args.length !== 2) throw new Error('>: requires exactly 2 arguments');
  return boolToVerdict(expectNum(args[0], '>') > expectNum(args[1], '>'));
});

register('<=', (args) => {
  if (args.length !== 2) throw new Error('<=: requires exactly 2 arguments');
  return boolToVerdict(expectNum(args[0], '<=') <= expectNum(args[1], '<='));
});

register('>=', (args) => {
  if (args.length !== 2) throw new Error('>=: requires exactly 2 arguments');
  return boolToVerdict(expectNum(args[0], '>=') >= expectNum(args[1], '>='));
});

register('!=', (args) => {
  if (args.length !== 2) throw new Error('!=: requires exactly 2 arguments');
  return boolToVerdict(!algEqual(args[0], args[1]));
});

// ── List operations ──────────────────────────────────────────────────

register('list', (args) => mkList(args));

register('first', (args) => {
  if (args.length !== 1) throw new Error('first: requires exactly 1 argument');
  const lst = args[0];
  if (lst.kind !== 'list' || lst.items.length === 0) {
    throw new Error('first: expected non-empty list');
  }
  return lst.items[0];
});

register('rest', (args) => {
  if (args.length !== 1) throw new Error('rest: requires exactly 1 argument');
  const lst = args[0];
  if (lst.kind !== 'list') throw new Error('rest: expected list');
  return mkList(lst.items.slice(1));
});

register('cons', (args) => {
  if (args.length !== 2) throw new Error('cons: requires exactly 2 arguments');
  const lst = args[1];
  if (lst.kind !== 'list') throw new Error('cons: second argument must be a list');
  return mkList([args[0], ...lst.items]);
});

register('length', (args) => {
  if (args.length !== 1) throw new Error('length: requires exactly 1 argument');
  const lst = args[0];
  if (lst.kind !== 'list') throw new Error('length: expected list');
  return mkNum(lst.items.length);
});

register('empty?', (args) => {
  if (args.length !== 1) throw new Error('empty?: requires exactly 1 argument');
  const lst = args[0];
  if (lst.kind !== 'list') throw new Error('empty?: expected list');
  return boolToVerdict(lst.items.length === 0);
});

// ── Type predicates ──────────────────────────────────────────────────

register('number?', (args) => {
  if (args.length !== 1) throw new Error('number?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'atom' && typeof args[0].value === 'number');
});

register('string?', (args) => {
  if (args.length !== 1) throw new Error('string?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'atom' && typeof args[0].value === 'string' && !args[0].isSymbol);
});

register('symbol?', (args) => {
  if (args.length !== 1) throw new Error('symbol?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'atom' && args[0].isSymbol);
});

register('list?', (args) => {
  if (args.length !== 1) throw new Error('list?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'list');
});

register('closure?', (args) => {
  if (args.length !== 1) throw new Error('closure?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'closure');
});

register('verdict?', (args) => {
  if (args.length !== 1) throw new Error('verdict?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'verdict');
});

register('contra?', (args) => {
  if (args.length !== 1) throw new Error('contra?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'contra');
});

register('hypothesis?', (args) => {
  if (args.length !== 1) throw new Error('hypothesis?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'hypothesis');
});

register('authority?', (args) => {
  if (args.length !== 1) throw new Error('authority?: requires 1 argument');
  return boolToVerdict(args[0].kind === 'authority');
});


// ── Belnap operations ────────────────────────────────────────────────

register('v-not', (args) => {
  if (args.length !== 1) throw new Error('v-not: requires 1 argument');
  const v = args[0];
  if (v.kind !== 'verdict') throw new Error('v-not: expected verdict');
  return mkVerdict(vNot(v.bits));
});

register('v-and', (args) => {
  if (args.length !== 2) throw new Error('v-and: requires 2 arguments');
  const a = args[0], b = args[1];
  if (a.kind !== 'verdict' || b.kind !== 'verdict') throw new Error('v-and: expected verdicts');
  return mkVerdict(vAnd(a.bits, b.bits));
});

register('v-or', (args) => {
  if (args.length !== 2) throw new Error('v-or: requires 2 arguments');
  const a = args[0], b = args[1];
  if (a.kind !== 'verdict' || b.kind !== 'verdict') throw new Error('v-or: expected verdicts');
  return mkVerdict(vOr(a.bits, b.bits));
});

register('true?', (args) => {
  if (args.length !== 1) throw new Error('true?: requires 1 argument');
  const v = args[0];
  if (v.kind !== 'verdict') throw new Error('true?: expected verdict');
  return boolToVerdict(isTrue(v));
});

register('false?', (args) => {
  if (args.length !== 1) throw new Error('false?: requires 1 argument');
  const v = args[0];
  if (v.kind !== 'verdict') throw new Error('false?: expected verdict');
  return boolToVerdict(isFalse(v));
});

register('both?', (args) => {
  if (args.length !== 1) throw new Error('both?: requires 1 argument');
  const v = args[0];
  if (v.kind !== 'verdict') throw new Error('both?: expected verdict');
  return boolToVerdict(isBoth(v));
});

register('neither?', (args) => {
  if (args.length !== 1) throw new Error('neither?: requires 1 argument');
  const v = args[0];
  if (v.kind !== 'verdict') throw new Error('neither?: expected verdict');
  return boolToVerdict(isNeither(v));
});

// ── Contra accessors ─────────────────────────────────────────────────

register('contra-yes', (args) => {
  if (args.length !== 1) throw new Error('contra-yes: requires 1 argument');
  if (args[0].kind !== 'contra') throw new Error('contra-yes: expected contra');
  return contraYes(args[0]);
});

register('contra-no', (args) => {
  if (args.length !== 1) throw new Error('contra-no: requires 1 argument');
  if (args[0].kind !== 'contra') throw new Error('contra-no: expected contra');
  return contraNo(args[0]);
});

register('contra-tension', (args) => {
  if (args.length !== 1) throw new Error('contra-tension: requires 1 argument');
  if (args[0].kind !== 'contra') throw new Error('contra-tension: expected contra');
  return mkNum(contraTension(args[0]));
});

register('contra-site', (args) => {
  if (args.length !== 1) throw new Error('contra-site: requires 1 argument');
  if (args[0].kind !== 'contra') throw new Error('contra-site: expected contra');
  return mkStr(contraSite(args[0]));
});

register('high-tension?', (args) => {
  if (args.length !== 1) throw new Error('high-tension?: requires 1 argument');
  if (args[0].kind !== 'contra') throw new Error('high-tension?: expected contra');
  return boolToVerdict(isHighTension(args[0]));
});

// ── Printing ─────────────────────────────────────────────────────────

register('print', (args) => {
  const out = args.map(formatValue).join(' ');
  process.stdout.write(out);
  return mkSym('nil');
});

register('println', (args) => {
  const out = args.map(formatValue).join(' ');
  process.stdout.write(out + '\n');
  return mkSym('nil');
});

// ── Equality ─────────────────────────────────────────────────────────

register('equal?', (args) => {
  if (args.length !== 2) throw new Error('equal?: requires exactly 2 arguments');
  return boolToVerdict(algEqual(args[0], args[1]));
});

// ── Verdict constructor ──────────────────────────────────────────────

register('verdict', (args) => {
  if (args.length !== 1) throw new Error('verdict: requires exactly 1 argument');
  const bits = expectNum(args[0], 'verdict');
  if (bits < 0 || bits > 3) throw new Error('verdict: bits must be 0-3');
  return mkVerdict(bits as 0 | 1 | 2 | 3);
});

// ── Helpers ──────────────────────────────────────────────────────────

function algEqual(a: AlgValue, b: AlgValue): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'atom' && b.kind === 'atom') {
    return a.value === b.value && a.isSymbol === b.isSymbol;
  }
  if (a.kind === 'list' && b.kind === 'list') {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((item, i) => algEqual(item, (b as AlgList).items[i]));
  }
  if (a.kind === 'verdict' && b.kind === 'verdict') {
    return a.bits === b.bits;
  }
  return a === b; // reference equality for closures, etc.
}

export { builtins };
