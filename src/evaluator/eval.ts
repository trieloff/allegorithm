/**
 * Main evaluator — walks the AST and produces Allegorithm values.
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from './context.js';
import { mkNum, mkStr, mkPolysemous } from '../types/index.js';
import { envLookup } from './env.js';
import { getSpecial } from './specials.js';
import { getBuiltin } from './prelude.js';
import { applyClosure } from './apply.js';

/**
 * Compute the cartesian product of polysemous args.
 * Non-polysemous values are repeated in every combination.
 * Reading names are joined with "×" for products.
 */
function cartesianExpand(args: AlgValue[]): { name: string; values: AlgValue[] }[] {
  // Start with a single empty combination
  let combos: { names: string[]; values: AlgValue[] }[] = [{ names: [], values: [] }];

  for (const arg of args) {
    if (arg.kind === 'polysemous') {
      const next: { names: string[]; values: AlgValue[] }[] = [];
      for (const combo of combos) {
        for (const reading of arg.readings) {
          next.push({
            names: [...combo.names, reading.name],
            values: [...combo.values, reading.value],
          });
        }
      }
      combos = next;
    } else {
      // Non-polysemous: append to every combo
      for (const combo of combos) {
        combo.values.push(arg);
      }
    }
  }

  return combos.map(c => ({
    name: c.names.join('×'),
    values: c.values,
  }));
}

/**
 * Evaluate an AST node in the given context, returning an AlgValue.
 */
export async function evalExpr(ast: ASTNode, ctx: EvalContext): Promise<AlgValue> {
  switch (ast.type) {
    case 'number':
      return mkNum(ast.value);

    case 'string':
      return mkStr(ast.value);

    case 'symbol': {
      const val = envLookup(ctx.env, ast.name);
      if (val === undefined) {
        // Check if it's a built-in function name — return a placeholder
        const builtin = getBuiltin(ast.name);
        if (builtin) {
          // Wrap built-in as a special atom so apply can find it
          return { kind: 'atom', value: `__builtin__:${ast.name}`, isSymbol: true } as AlgValue;
        }
        throw new Error(`Unbound symbol: ${ast.name} at line ${ast.line}, col ${ast.col}`);
      }
      return val;
    }

    case 'list': {
      if (ast.elements.length === 0) {
        // Empty list evaluates to empty list
        return { kind: 'list', items: [] };
      }

      const head = ast.elements[0];

      // Check for special forms
      if (head.type === 'symbol') {
        const special = getSpecial(head.name);
        if (special) {
          return special(ast.elements.slice(1), ctx, evalExpr);
        }
      }

      // Function call: eval head, eval args, apply
      const fn = await evalExpr(head, ctx);
      const args: AlgValue[] = [];
      for (const arg of ast.elements.slice(1)) {
        args.push(await evalExpr(arg, ctx));
      }

      // Check for polysemy propagation: pure functions map over polysemous args
      const hasPolysemy = args.some(a => a.kind === 'polysemous');
      if (hasPolysemy) {
        const expanded = cartesianExpand(args);
        const results: { name: string; value: AlgValue }[] = [];
        for (const { name, values } of expanded) {
          if (fn.kind === 'closure') {
            results.push({ name, value: await applyClosure(fn, values, ctx, evalExpr) });
          } else if (fn.kind === 'atom' && fn.isSymbol && typeof fn.value === 'string' && fn.value.startsWith('__builtin__:')) {
            const bname = fn.value.slice('__builtin__:'.length);
            const builtin = getBuiltin(bname);
            if (builtin) results.push({ name, value: builtin(values) });
          } else {
            throw new Error(`Cannot call ${fn.kind} as a function`);
          }
        }
        return mkPolysemous(results);
      }

      // Closure application
      if (fn.kind === 'closure') {
        return applyClosure(fn, args, ctx, evalExpr);
      }

      // Built-in function reference
      if (fn.kind === 'atom' && fn.isSymbol && typeof fn.value === 'string' && fn.value.startsWith('__builtin__:')) {
        const name = fn.value.slice('__builtin__:'.length);
        const builtin = getBuiltin(name);
        if (builtin) return builtin(args);
      }

      throw new Error(`Cannot call ${fn.kind} as a function`);
    }
  }
}
