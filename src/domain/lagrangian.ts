/**
 * Lagrangian definition and symmetry detection for Allegorithm.
 *
 * Implements:
 *   (deflagrangian name (param m :units kg) (field x :units m) (L expr))
 *   (simulate-lagrangian L :ic ((x 0) (v 3)) :t 1 :dt 0.1 :m 1)
 *
 * Symmetry detection is rule-based AST analysis:
 *   - Time-translation: L doesn't depend explicitly on t → energy conserved
 *   - Space-translation: L depends on velocity not position → momentum conserved
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from '../evaluator/context.js';
import type { EvalFn } from '../evaluator/specials.js';
import { mkList, mkSym, mkNum, mkStr, mkVerdict, TRUE, FALSE } from '../types/index.js';
import { envSet } from '../evaluator/env.js';

// ── Lagrangian data type ────────────────────────────────────────────

export interface LagrangianParam {
  units: string;
}

export interface LagrangianField {
  units: string;
}

export interface Lagrangian {
  name: string;
  params: Map<string, LagrangianParam>;
  fields: Map<string, LagrangianField>;
  expression: ASTNode;
}

/** Registry of defined Lagrangians, keyed by unique ID. */
const lagrangianRegistry = new Map<number, Lagrangian>();
let nextLagrangianId = 1;

/** Create a Lagrangian and return a reference atom. */
export function createLagrangian(l: Lagrangian): AlgValue {
  const id = nextLagrangianId++;
  lagrangianRegistry.set(id, l);
  return { kind: 'atom', value: `__lagrangian__:${id}`, isSymbol: true } as AlgValue;
}

/** Resolve a Lagrangian reference. */
export function resolveLagrangian(ref: AlgValue): Lagrangian | undefined {
  if (ref.kind !== 'atom' || !ref.isSymbol || typeof ref.value !== 'string') return undefined;
  const match = (ref.value as string).match(/^__lagrangian__:(\d+)$/);
  if (!match) return undefined;
  return lagrangianRegistry.get(Number(match[1]));
}

/** Check if a value is a Lagrangian reference. */
export function isLagrangianRef(v: AlgValue): boolean {
  return resolveLagrangian(v) !== undefined;
}

/** Reset registry (for testing). */
export function resetLagrangianRegistry(): void {
  lagrangianRegistry.clear();
  nextLagrangianId = 1;
}

// ── Symmetry detection ──────────────────────────────────────────────

export interface Symmetry {
  name: string;
  conservedQuantity: string;
  description: string;
}

/**
 * Collect all free symbols in an AST expression.
 * A symbol under (∂t x) or (deriv x t) counts as a derivative reference,
 * not a free occurrence of x.
 */
function collectFreeSymbols(node: ASTNode, derivativeArgs: Set<string> = new Set()): Set<string> {
  const syms = new Set<string>();

  switch (node.type) {
    case 'number':
    case 'string':
      break;
    case 'symbol':
      if (!derivativeArgs.has(node.name)) {
        syms.add(node.name);
      }
      break;
    case 'list': {
      const els = node.elements;
      if (els.length >= 2 && els[0].type === 'symbol' &&
          (els[0].name === '∂t' || els[0].name === 'deriv')) {
        // This is a derivative form — the field argument is NOT free
        // For (∂t x), x is under derivative. For (deriv x t), x is under derivative.
        // But record that velocity (the derivative itself) appears.
        // Don't add the field name as free — it's accessed via its derivative.
        if (els[0].name === '∂t' && els.length === 2 && els[1].type === 'symbol') {
          // (∂t x) — x is under derivative, not free
          // The whole expression represents velocity, which IS a free reference
          // but we track it separately
          syms.add(`∂t(${els[1].name})`); // synthetic marker for velocity
        } else if (els[0].name === 'deriv' && els.length === 3 && els[1].type === 'symbol') {
          syms.add(`∂t(${els[1].name})`);
        }
      } else if (els.length >= 2 && els[0].type === 'symbol' && els[0].name === 'square') {
        // (square expr) — recurse into the expression
        for (let i = 1; i < els.length; i++) {
          for (const s of collectFreeSymbols(els[i], derivativeArgs)) {
            syms.add(s);
          }
        }
      } else {
        // Regular list: recurse into all elements
        for (const el of els) {
          for (const s of collectFreeSymbols(el, derivativeArgs)) {
            syms.add(s);
          }
        }
      }
      break;
    }
  }

  return syms;
}

/**
 * Detect symmetries of a Lagrangian by AST analysis.
 */
export function detectSymmetries(lagrangian: Lagrangian): Symmetry[] {
  const symmetries: Symmetry[] = [];
  const freeSyms = collectFreeSymbols(lagrangian.expression);
  const fieldNames = Array.from(lagrangian.fields.keys());

  // Time-translation invariance: L doesn't depend explicitly on t
  if (!freeSyms.has('t')) {
    symmetries.push({
      name: 'time-translation',
      conservedQuantity: 'energy',
      description: 'L does not depend explicitly on t → energy is conserved',
    });
  }

  // Space-translation invariance: for each field, L depends on velocity but not position
  for (const field of fieldNames) {
    const hasPosition = freeSyms.has(field);
    const hasVelocity = freeSyms.has(`∂t(${field})`);
    if (!hasPosition && hasVelocity) {
      symmetries.push({
        name: 'space-translation',
        conservedQuantity: 'momentum',
        description: `L does not depend on ${field}, only on ∂t(${field}) → momentum is conserved`,
      });
    }
  }

  return symmetries;
}

// ── Special form: deflagrangian ─────────────────────────────────────

/**
 * (deflagrangian name (param m :units kg) (field x :units m) (L expr))
 */
export async function handleDeflagrangian(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length < 2) throw new Error('deflagrangian requires a name and at least one clause');

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('deflagrangian: first argument must be a symbol');
  const name = nameNode.name;

  const params = new Map<string, LagrangianParam>();
  const fields = new Map<string, LagrangianField>();
  let expression: ASTNode | null = null;

  for (let i = 1; i < args.length; i++) {
    const clause = args[i];
    if (clause.type !== 'list' || clause.elements.length < 2) {
      throw new Error('deflagrangian: each clause must be a list');
    }

    const head = clause.elements[0];
    if (head.type !== 'symbol') throw new Error('deflagrangian: clause head must be a symbol');

    switch (head.name) {
      case 'param': {
        // (param m :units kg)
        const pname = clause.elements[1];
        if (pname.type !== 'symbol') throw new Error('deflagrangian: param name must be a symbol');
        let units = 'dimensionless';
        for (let j = 2; j < clause.elements.length; j++) {
          const kw = clause.elements[j];
          if (kw.type === 'symbol' && kw.name === ':units' && j + 1 < clause.elements.length) {
            const unode = clause.elements[j + 1];
            if (unode.type === 'symbol') units = unode.name;
            else if (unode.type === 'string') units = unode.value;
            j++;
          }
        }
        params.set(pname.name, { units });
        break;
      }
      case 'field': {
        // (field x :units m)
        const fname = clause.elements[1];
        if (fname.type !== 'symbol') throw new Error('deflagrangian: field name must be a symbol');
        let units = 'dimensionless';
        for (let j = 2; j < clause.elements.length; j++) {
          const kw = clause.elements[j];
          if (kw.type === 'symbol' && kw.name === ':units' && j + 1 < clause.elements.length) {
            const unode = clause.elements[j + 1];
            if (unode.type === 'symbol') units = unode.name;
            else if (unode.type === 'string') units = unode.value;
            j++;
          }
        }
        fields.set(fname.name, { units });
        break;
      }
      case 'L': {
        // (L expr)
        expression = clause.elements[1];
        break;
      }
      default:
        throw new Error(`deflagrangian: unknown clause "${head.name}"`);
    }
  }

  if (!expression) throw new Error('deflagrangian: missing (L expr) clause');

  const lagrangian: Lagrangian = { name, params, fields, expression };
  const ref = createLagrangian(lagrangian);
  ctx.env = envSet(ctx.env, name, ref);
  return ref;
}

// ── Simulation ──────────────────────────────────────────────────────

export interface TracePoint {
  t: number;
  x: number;
  v: number;
}

/**
 * Simple Euler integration for a free particle (or simple Lagrangian).
 * For the foundation, this handles the free-particle case:
 *   L = ½mv² → no force → x += v*dt, v unchanged
 *
 * Returns a list of trace points as AlgValues.
 */
function simulateFreeParticle(
  paramValues: Map<string, number>,
  ic: Map<string, number>,
  tEnd: number,
  dt: number,
): TracePoint[] {
  const trace: TracePoint[] = [];
  let x = ic.get('x') ?? 0;
  let v = ic.get('v') ?? 0;
  let t = 0;

  while (t <= tEnd + dt / 2) {
    trace.push({ t, x, v });
    // Euler step for free particle: no acceleration
    x += v * dt;
    t += dt;
  }

  return trace;
}

/**
 * Convert a trace to an AlgValue list of snapshots.
 * Each snapshot is a list: (list t x v)
 */
function traceToAlgValue(trace: TracePoint[], m: number): AlgValue {
  return mkList(trace.map(p => mkList([
    mkList([mkSym('t'), mkNum(p.t)]),
    mkList([mkSym('x'), mkNum(p.x)]),
    mkList([mkSym('v'), mkNum(p.v)]),
    mkList([mkSym('m'), mkNum(m)]),
  ])));
}

/**
 * (simulate-lagrangian L :ic ((x 0) (v 3)) :t 1 :dt 0.1 :m 1)
 */
export async function handleSimulateLagrangian(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length < 1) throw new Error('simulate-lagrangian requires at least 1 argument');

  // First arg is the Lagrangian reference
  const lagRef = await evalExpr(args[0], ctx);
  const lagrangian = resolveLagrangian(lagRef);
  if (!lagrangian) throw new Error('simulate-lagrangian: first argument must be a Lagrangian');

  // Parse keyword arguments
  const ic = new Map<string, number>();
  let tEnd = 1;
  let dt = 0.1;
  const paramValues = new Map<string, number>();

  let i = 1;
  while (i < args.length) {
    const kwNode = args[i];
    if (kwNode.type !== 'symbol') throw new Error(`simulate-lagrangian: expected keyword at position ${i}`);

    switch (kwNode.name) {
      case ':ic': {
        i++;
        if (i >= args.length) throw new Error('simulate-lagrangian: :ic requires a value');
        const icVal = await evalExpr(args[i], ctx);
        if (icVal.kind !== 'list') throw new Error('simulate-lagrangian: :ic must be a list');
        for (const pair of icVal.items) {
          if (pair.kind !== 'list' || pair.items.length !== 2) {
            throw new Error('simulate-lagrangian: :ic entries must be (name value) pairs');
          }
          const k = pair.items[0];
          const v = pair.items[1];
          if (k.kind !== 'atom' || !k.isSymbol) throw new Error('simulate-lagrangian: :ic key must be a symbol');
          if (v.kind !== 'atom' || typeof v.value !== 'number') throw new Error('simulate-lagrangian: :ic value must be a number');
          ic.set(k.value as string, v.value as number);
        }
        break;
      }
      case ':t': {
        i++;
        if (i >= args.length) throw new Error('simulate-lagrangian: :t requires a value');
        const tVal = await evalExpr(args[i], ctx);
        if (tVal.kind !== 'atom' || typeof tVal.value !== 'number') throw new Error('simulate-lagrangian: :t must be a number');
        tEnd = tVal.value;
        break;
      }
      case ':dt': {
        i++;
        if (i >= args.length) throw new Error('simulate-lagrangian: :dt requires a value');
        const dtVal = await evalExpr(args[i], ctx);
        if (dtVal.kind !== 'atom' || typeof dtVal.value !== 'number') throw new Error('simulate-lagrangian: :dt must be a number');
        dt = dtVal.value;
        break;
      }
      default: {
        // Assume it's a parameter name like :m
        const pname = kwNode.name.startsWith(':') ? kwNode.name.slice(1) : kwNode.name;
        i++;
        if (i >= args.length) throw new Error(`simulate-lagrangian: ${kwNode.name} requires a value`);
        const pVal = await evalExpr(args[i], ctx);
        if (pVal.kind !== 'atom' || typeof pVal.value !== 'number') {
          throw new Error(`simulate-lagrangian: ${kwNode.name} must be a number`);
        }
        paramValues.set(pname, pVal.value);
        break;
      }
    }
    i++;
  }

  const trace = simulateFreeParticle(paramValues, ic, tEnd, dt);
  const m = paramValues.get('m') ?? 1;
  return traceToAlgValue(trace, m);
}
