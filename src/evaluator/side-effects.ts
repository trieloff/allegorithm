/**
 * Side-effect discipline for polysemous values.
 *
 * Functions with side effects MUST use a suffix:
 * - fn!   — Fan: cartesian product across all polysemous args
 * - fn?   — Guard: only execute if all args are certain (no polysemy)
 * - fn... — Pick: resolve to first reading, execute once
 *
 * Bare side-effectful calls (e.g. `utter` with no suffix) are errors.
 */

import type { AlgValue } from '../types/index.js';
import { mkSym } from '../types/index.js';
import { printValue } from '../printer/printer.js';
import { registerSpecial } from './specials.js';
import type { EvalFn } from './specials.js';
import type { EvalContext } from './context.js';
import type { ASTNode } from '../parser/index.js';

/** Display a value for user-facing output: strings are unquoted. */
function displayValue(v: AlgValue): string {
  if (v.kind === 'atom' && typeof v.value === 'string' && !v.isSymbol) {
    return v.value; // unquoted string
  }
  return printValue(v);
}

/** Resolve the first reading from each polysemous arg. */
function resolveFirst(args: AlgValue[]): AlgValue[] {
  return args.map(a => {
    if (a.kind === 'polysemous' && a.readings.length > 0) {
      return a.readings[0].value;
    }
    return a;
  });
}

/** Check if any arg is polysemous. */
function hasPolysemy(args: AlgValue[]): boolean {
  return args.some(a => a.kind === 'polysemous');
}

/**
 * Resolve all polysemous args via cartesian product.
 * Returns an array of fully-resolved arg lists.
 */
function resolveAll(args: AlgValue[]): AlgValue[][] {
  if (args.length === 0) return [[]];

  const [first, ...rest] = args;
  const restCombinations = resolveAll(rest);

  if (first.kind === 'polysemous') {
    const results: AlgValue[][] = [];
    for (const reading of first.readings) {
      for (const restCombo of restCombinations) {
        results.push([reading.value, ...restCombo]);
      }
    }
    return results;
  } else {
    return restCombinations.map(combo => [first, ...combo]);
  }
}

/** Helper to evaluate all args in a special form. */
async function evalArgs(args: ASTNode[], ctx: EvalContext, evalExpr: EvalFn): Promise<AlgValue[]> {
  const evaluated: AlgValue[] = [];
  for (const arg of args) {
    evaluated.push(await evalExpr(arg, ctx));
  }
  return evaluated;
}

// ── utter! — Fan: cartesian product, execute for each combination ──

registerSpecial('utter!', async (args, ctx, evalExpr) => {
  const evaluated = await evalArgs(args, ctx, evalExpr);
  const combinations = resolveAll(evaluated);
  for (const combo of combinations) {
    const out = combo.map(displayValue).join('');
    process.stdout.write(out + '\n');
  }
  return mkSym('nil');
});

// ── utter? — Guard: only if all args are certain (no polysemy) ──

registerSpecial('utter?', async (args, ctx, evalExpr) => {
  const evaluated = await evalArgs(args, ctx, evalExpr);
  if (hasPolysemy(evaluated)) {
    return mkSym('nil'); // silently do nothing
  }
  const out = evaluated.map(displayValue).join('');
  process.stdout.write(out + '\n');
  return mkSym('nil');
});

// ── utter... — Pick: resolve to first reading, execute once ──

registerSpecial('utter...', async (args, ctx, evalExpr) => {
  const evaluated = await evalArgs(args, ctx, evalExpr);
  const resolved = resolveFirst(evaluated);
  const out = resolved.map(displayValue).join('');
  process.stdout.write(out + '\n');
  return mkSym('nil');
});

// ── Bare utter — error ──

registerSpecial('utter', async () => {
  throw new Error(
    'utter: side-effectful function called without polysemy suffix. ' +
    'Use utter! (fan all), utter? (guard), or utter... (pick first)',
  );
});
