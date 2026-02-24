/**
 * Special form handlers for reading-related forms.
 *
 * These are exported as handler functions to be registered by the evaluator.
 * Each handler takes AST arguments and an evaluation context, and returns
 * an AlgValue.
 *
 * Forms:
 *   (deffable name body...)      → Fable
 *   (defreading name :spine S :map M :witness W :metric F) → Reading
 *   (with-reading R expr...)     → result of last expr under reading R
 *   (polyread [R1 R2 ...] fable :compare K :tol ε) → PolyreadResult
 *   (allegorize R fable)         → Fable (re-read IR)
 */

import type { ASTNode } from '../parser/ast.js';
import type { AlgValue, Reading, Fable } from '../types/values.js';
import { mkFable, mkReading, mkSym, mkStr, mkNum, mkList } from '../types/values.js';
import type { EvalContext } from './context.js';
import { compileFable } from '../readings/fable.js';
import { allegorize } from '../readings/allegorize.js';
import type { MeaningGraph } from '../readings/meaning-graph.js';
import { applyReading } from '../readings/reading.js';
import { envSet } from './env.js';

/** Type for an eval function that the evaluator provides. */
export type EvalFn = (node: ASTNode, ctx: EvalContext) => AlgValue | Promise<AlgValue>;

// ── handleDeffable ───────────────────────────────────────────────────

/**
 * (deffable name body...)
 *
 * Compile body into a MeaningGraph, wrap in a Fable value.
 * The name is a symbol; the body is a list of forms.
 */
export async function handleDeffable(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): Promise<AlgValue> {
  if (args.length < 2) {
    throw new Error('deffable requires a name and at least one body form');
  }

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') {
    throw new Error('deffable name must be a symbol');
  }

  const graph = compileFable(nameNode.name, args.slice(1));
  const fable = mkFable(graph);

  // Auto-bind the fable to its name in the environment
  ctx.env = envSet(ctx.env, nameNode.name, fable);

  return fable;
}

// ── handleDefreading ─────────────────────────────────────────────────

/**
 * (defreading name :spine S :map M :witness W :metric F)
 *
 * Create a Reading from the declaration. Keyword arguments are parsed
 * from the args list.
 */
export async function handleDefreading(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): Promise<AlgValue> {
  if (args.length < 1) {
    throw new Error('defreading requires a name');
  }

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') {
    throw new Error('defreading name must be a symbol');
  }

  const name = nameNode.name;
  let spine: AlgValue = mkSym('bond-graph');
  const map = new Map<string, AlgValue>();
  const witnesses: AlgValue[] = [];
  let metric = 1.0;

  // Parse keyword arguments
  let i = 1;
  while (i < args.length) {
    const kw = args[i];
    if (kw.type === 'symbol' && kw.name.startsWith(':')) {
      const key = kw.name.slice(1);
      i++;
      if (i >= args.length) break;

      switch (key) {
        case 'spine':
          // Treat spine as a symbol name, not an expression to evaluate
          if (args[i].type === 'symbol') {
            spine = mkSym(args[i].name);
          } else {
            spine = await evalFn(args[i], ctx);
          }
          break;
        case 'map': {
          // Expect a list of key-value pairs: ((effort voltage) (flow current) ...)
          const mapVal = await evalFn(args[i], ctx);
          if (mapVal.kind === 'list') {
            for (const pair of mapVal.items) {
              if (pair.kind === 'list' && pair.items.length >= 2) {
                const k = pair.items[0];
                const v = pair.items[1];
                if (k.kind === 'atom') {
                  map.set(String(k.value), v);
                }
              }
            }
          }
          break;
        }
        case 'witness':
        case 'witness.objective':
        case 'witness.subjective': {
          const wVal = await evalFn(args[i], ctx);
          if (wVal.kind === 'list') {
            witnesses.push(...wVal.items);
          } else {
            witnesses.push(wVal);
          }
          break;
        }
        case 'metric': {
          const mVal = await evalFn(args[i], ctx);
          if (mVal.kind === 'atom' && typeof mVal.value === 'number') {
            metric = mVal.value;
          }
          break;
        }
      }
      i++;
    } else {
      i++;
    }
  }

  const reading = mkReading(name, spine, map, witnesses, metric);

  // Auto-bind the reading to its name
  ctx.env = envSet(ctx.env, name, reading);

  return reading;
}

// ── handleWithReading ────────────────────────────────────────────────

/**
 * (with-reading R expr...)
 *
 * Push reading R onto the context's reading stack, evaluate body
 * expressions with the meaning graph rewritten per R's map.
 * Returns the result of the last expression.
 */
export async function handleWithReading(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): Promise<AlgValue> {
  if (args.length < 2) {
    throw new Error('with-reading requires a reading and at least one body expression');
  }

  const readingVal = await evalFn(args[0], ctx);
  if (readingVal.kind !== 'reading') {
    throw new Error('with-reading first argument must evaluate to a Reading');
  }

  // Push reading onto context
  const newCtx: EvalContext = {
    ...ctx,
    readings: [...ctx.readings, readingVal],
  };

  // Evaluate body expressions in sequence under the new context
  let result: AlgValue = mkSym('nil');
  for (let i = 1; i < args.length; i++) {
    result = await evalFn(args[i], newCtx);
  }

  return result;
}

// ── handlePolyread ───────────────────────────────────────────────────

/**
 * (polyread [R1 R2 ...] fable :compare K :tol ε)
 *
 * Run multi-reading coherence check. Returns the polyread result
 * as an Allegorithm value (either a list for coherent, or Contra).
 */
export async function handlePolyread(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): Promise<AlgValue> {
  if (args.length < 2) {
    throw new Error('polyread requires readings and a fable');
  }

  // Evaluate readings list
  const readingsVal = await evalFn(args[0], ctx);
  if (readingsVal.kind !== 'list') {
    throw new Error('polyread first argument must be a list of readings');
  }

  const readings: Reading[] = [];
  for (const item of readingsVal.items) {
    if (item.kind !== 'reading') {
      throw new Error('polyread readings list must contain only Reading values');
    }
    readings.push(item);
  }

  // Evaluate fable
  const fableVal = await evalFn(args[1], ctx);
  if (fableVal.kind !== 'fable') {
    throw new Error('polyread second argument must be a Fable');
  }

  // Parse optional keyword arguments
  let tolerance = 0;
  let i = 2;
  while (i < args.length) {
    const kw = args[i];
    if (kw.type === 'symbol' && kw.name === ':tol') {
      i++;
      if (i < args.length) {
        const tolVal = await evalFn(args[i], ctx);
        if (tolVal.kind === 'atom' && typeof tolVal.value === 'number') {
          tolerance = tolVal.value;
        }
      }
    }
    i++;
  }

  // Synchronous simplified polyread (no real ODE solver, structural comparison)
  // Compare STRUCTURAL invariants, not surface names — surface names are
  // supposed to differ across readings (that's the whole point of allegory).
  const graph = fableVal.graph as MeaningGraph;
  const perReadingResults = new Map<string, AlgValue>();

  // Role distribution from the ORIGINAL graph (invariant across readings)
  const roleCounts = new Map<string, number>();
  for (const node of graph.nodes.values()) {
    roleCounts.set(node.type, (roleCounts.get(node.type) ?? 0) + 1);
  }
  const rolesSig = [...roleCounts.entries()].sort().map(([t, c]) => `${t}:${c}`).join(',');

  // Connectivity signature (node IDs are stable across readings)
  const connectivitySigs: string[] = [];

  for (const reading of readings) {
    const reread = applyReading(graph, reading);
    const connSig = reread.edges
      .map(e => `${e.from}->${e.to}`)
      .sort()
      .join(';');
    connectivitySigs.push(connSig);
    perReadingResults.set(reading.name, mkStr(rolesSig));
  }

  // Compute residual: structural differences across readings
  // Node count and edge count are always identical (applyReading doesn't add/remove)
  // Connectivity is always identical (applyReading doesn't change IDs)
  // So residual is 0 for structurally coherent readings
  const distinctConnectivity = new Set(connectivitySigs).size;
  const residual = distinctConnectivity <= 1 ? 0 : distinctConnectivity;

  if (residual <= tolerance) {
    const items: AlgValue[] = [
      mkSym('coherent'),
      mkNum(residual),
    ];
    for (const [name, val] of perReadingResults) {
      items.push(mkList([mkStr(name), val]));
    }
    return mkList(items);
  }

  // Incoherent: return Contra
  const names = [...perReadingResults.keys()];
  return {
    kind: 'contra' as const,
    yes: perReadingResults.get(names[0]) ?? mkStr('unknown'),
    no: perReadingResults.get(names[1]) ?? mkStr('unknown'),
    whyP: mkStr(`Reading "${names[0]}"`),
    whyN: mkStr(`Reading "${names[1]}"`),
    tension: residual,
    site: 'polyread',
  };
}

// ── handleAllegorize ─────────────────────────────────────────────────

/**
 * (allegorize R fable)
 *
 * Return the re-read IR/program, not its value.
 */
export async function handleAllegorize(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): Promise<AlgValue> {
  if (args.length < 2) {
    throw new Error('allegorize requires a reading and a fable');
  }

  const readingVal = await evalFn(args[0], ctx);
  if (readingVal.kind !== 'reading') {
    throw new Error('allegorize first argument must evaluate to a Reading');
  }

  const fableVal = await evalFn(args[1], ctx);
  if (fableVal.kind !== 'fable') {
    throw new Error('allegorize second argument must evaluate to a Fable');
  }

  return allegorize(readingVal, fableVal);
}
