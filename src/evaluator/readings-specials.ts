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

/** Type for an eval function that the evaluator provides. */
export type EvalFn = (node: ASTNode, ctx: EvalContext) => AlgValue;

// ── handleDeffable ───────────────────────────────────────────────────

/**
 * (deffable name body...)
 *
 * Compile body into a MeaningGraph, wrap in a Fable value.
 * The name is a symbol; the body is a list of forms.
 */
export function handleDeffable(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): AlgValue {
  if (args.length < 2) {
    throw new Error('deffable requires a name and at least one body form');
  }

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') {
    throw new Error('deffable name must be a symbol');
  }

  const graph = compileFable(nameNode.name, args.slice(1));
  return mkFable(graph);
}

// ── handleDefreading ─────────────────────────────────────────────────

/**
 * (defreading name :spine S :map M :witness W :metric F)
 *
 * Create a Reading from the declaration. Keyword arguments are parsed
 * from the args list.
 */
export function handleDefreading(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): AlgValue {
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
          spine = evalFn(args[i], ctx);
          break;
        case 'map': {
          // Expect a list of key-value pairs: ((effort voltage) (flow current) ...)
          const mapVal = evalFn(args[i], ctx);
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
        case 'witness': {
          const wVal = evalFn(args[i], ctx);
          if (wVal.kind === 'list') {
            witnesses.push(...wVal.items);
          } else {
            witnesses.push(wVal);
          }
          break;
        }
        case 'metric': {
          const mVal = evalFn(args[i], ctx);
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

  return mkReading(name, spine, map, witnesses, metric);
}

// ── handleWithReading ────────────────────────────────────────────────

/**
 * (with-reading R expr...)
 *
 * Push reading R onto the context's reading stack, evaluate body
 * expressions with the meaning graph rewritten per R's map.
 * Returns the result of the last expression.
 */
export function handleWithReading(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): AlgValue {
  if (args.length < 2) {
    throw new Error('with-reading requires a reading and at least one body expression');
  }

  const readingVal = evalFn(args[0], ctx);
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
    result = evalFn(args[i], newCtx);
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
export function handlePolyread(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): AlgValue {
  if (args.length < 2) {
    throw new Error('polyread requires readings and a fable');
  }

  // Evaluate readings list
  const readingsVal = evalFn(args[0], ctx);
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
  const fableVal = evalFn(args[1], ctx);
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
        const tolVal = evalFn(args[i], ctx);
        if (tolVal.kind === 'atom' && typeof tolVal.value === 'number') {
          tolerance = tolVal.value;
        }
      }
    }
    i++;
  }

  // Synchronous simplified polyread (no real ODE solver, structural comparison)
  const graph = fableVal.graph as MeaningGraph;
  const perReadingResults = new Map<string, AlgValue>();

  for (const reading of readings) {
    const reread = applyReading(graph, reading);
    const types = [...reread.nodes.values()].map(n => n.type).sort().join(',');
    perReadingResults.set(reading.name, mkStr(types));
  }

  // Compute residual: count distinct topologies
  const topologies = [...perReadingResults.values()].map(v =>
    v.kind === 'atom' ? String(v.value) : '',
  );
  const distinctCount = new Set(topologies).size;
  const residual = distinctCount <= 1 ? 0 : distinctCount;

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
export function handleAllegorize(args: ASTNode[], ctx: EvalContext, evalFn: EvalFn): AlgValue {
  if (args.length < 2) {
    throw new Error('allegorize requires a reading and a fable');
  }

  const readingVal = evalFn(args[0], ctx);
  if (readingVal.kind !== 'reading') {
    throw new Error('allegorize first argument must evaluate to a Reading');
  }

  const fableVal = evalFn(args[1], ctx);
  if (fableVal.kind !== 'fable') {
    throw new Error('allegorize second argument must evaluate to a Fable');
  }

  return allegorize(readingVal, fableVal);
}
