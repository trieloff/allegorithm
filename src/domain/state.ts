/**
 * State containers for the Allegorithm event/simulation system.
 *
 * State containers are mutable references stored in the eval context.
 * The key container type is `cycle` — a cyclic list of segments.
 *
 * Special forms:
 *   (state (cycle (list s1 s2 s3)))  — create a cyclic state container
 *   (state-segments container)        — get current segments as a list
 *   (state-set-segments! container new-segments) — replace segments
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from '../evaluator/context.js';
import type { EvalFn } from '../evaluator/specials.js';
import { mkList, mkSym, mkNum, mkStr } from '../types/index.js';

/** A mutable state container reference. Stored as an AlgValue via a wrapper atom. */
export interface StateContainer {
  type: 'cycle' | 'bag' | 'stack';
  segments: AlgValue[];
}

/** Registry of all live state containers, keyed by unique ID. */
const stateRegistry = new Map<number, StateContainer>();
let nextStateId = 1;

/** Create a state container and return a reference atom. */
export function createState(type: StateContainer['type'], segments: AlgValue[]): AlgValue {
  const id = nextStateId++;
  stateRegistry.set(id, { type, segments });
  // Return a tagged atom that encodes the state reference
  return { kind: 'atom', value: `__state__:${id}`, isSymbol: true } as AlgValue;
}

/** Resolve a state reference atom to its container. */
export function resolveState(ref: AlgValue): StateContainer | undefined {
  if (ref.kind !== 'atom' || !ref.isSymbol || typeof ref.value !== 'string') return undefined;
  const match = (ref.value as string).match(/^__state__:(\d+)$/);
  if (!match) return undefined;
  return stateRegistry.get(Number(match[1]));
}

/** Check if a value is a state container reference. */
export function isStateRef(v: AlgValue): boolean {
  return resolveState(v) !== undefined;
}

// ── Special form handlers ────────────────────────────────────────────

/**
 * (state (cycle (list ...)))
 * (state (bag (list ...)))
 * (state (stack (list ...)))
 */
export async function handleState(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('state: requires exactly 1 argument');

  const inner = args[0];
  if (inner.type !== 'list' || inner.elements.length < 1) {
    throw new Error('state: argument must be (cycle|bag|stack items)');
  }

  const typeNode = inner.elements[0];
  if (typeNode.type !== 'symbol') throw new Error('state: first element must be cycle, bag, or stack');
  const type = typeNode.name as StateContainer['type'];
  if (!['cycle', 'bag', 'stack'].includes(type)) {
    throw new Error(`state: unknown container type "${type}"`);
  }

  // Evaluate the items argument
  const itemsVal = await evalExpr(inner.elements[1], ctx);
  let segments: AlgValue[];
  if (itemsVal.kind === 'list') {
    segments = [...itemsVal.items];
  } else {
    segments = [itemsVal];
  }

  return createState(type, segments);
}

/**
 * (state-segments container) — get segments as a list
 */
export async function handleStateSegments(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('state-segments: requires 1 argument');
  const ref = await evalExpr(args[0], ctx);
  const container = resolveState(ref);
  if (!container) throw new Error('state-segments: argument is not a state container');
  return mkList(container.segments);
}

/**
 * (state-nth container index) — get segment at index (cyclic for cycle containers)
 */
export async function handleStateNth(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 2) throw new Error('state-nth: requires 2 arguments');
  const ref = await evalExpr(args[0], ctx);
  const idxVal = await evalExpr(args[1], ctx);
  const container = resolveState(ref);
  if (!container) throw new Error('state-nth: first argument is not a state container');
  if (idxVal.kind !== 'atom' || typeof idxVal.value !== 'number') {
    throw new Error('state-nth: second argument must be a number');
  }
  const idx = idxVal.value as number;
  if (container.type === 'cycle') {
    // Cyclic indexing
    const len = container.segments.length;
    if (len === 0) throw new Error('state-nth: empty container');
    const i = ((idx % len) + len) % len;
    return container.segments[i];
  }
  if (idx < 0 || idx >= container.segments.length) {
    throw new Error(`state-nth: index ${idx} out of bounds`);
  }
  return container.segments[idx];
}

/**
 * (state-count container) — number of segments
 */
export async function handleStateCount(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('state-count: requires 1 argument');
  const ref = await evalExpr(args[0], ctx);
  const container = resolveState(ref);
  if (!container) throw new Error('state-count: argument is not a state container');
  return mkNum(container.segments.length);
}

/** Reset the state registry (for testing). */
export function resetStateRegistry(): void {
  stateRegistry.clear();
  nextStateId = 1;
}
