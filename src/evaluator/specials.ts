/**
 * Special form handlers for the Allegorithm evaluator.
 *
 * Each handler receives the unevaluated argument AST nodes, the eval context,
 * and the evalExpr function (to avoid circular imports).
 *
 * Other agents can register additional special forms via `registerSpecial`.
 */

import type { ASTNode, ListNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from './context.js';
import {
  mkNum, mkStr, mkSym, mkList, mkVerdict, mkHypothesis,
  BOTH, NEITHER, TRUE, FALSE,
  isTrue, isFalse,
} from '../types/index.js';
import { mkContra, isContra } from '../types/contra.js';
import { envLookup, envSet } from './env.js';
import { extendEnv } from '../types/index.js';

/** Signature for an evalExpr function passed to handlers. */
export type EvalFn = (ast: ASTNode, ctx: EvalContext) => Promise<AlgValue>;

/** Signature for a special form handler. */
export type SpecialHandler = (
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
) => Promise<AlgValue>;

/** The mutable registry of special forms. */
const specials = new Map<string, SpecialHandler>();

/** Register a special form handler. */
export function registerSpecial(name: string, handler: SpecialHandler): void {
  specials.set(name, handler);
}

/** Look up a special form handler by name. */
export function getSpecial(name: string): SpecialHandler | undefined {
  return specials.get(name);
}

// ── Built-in special forms ───────────────────────────────────────────

/** (def name value) — bind in current env, return value */
registerSpecial('def', async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('def requires exactly 2 arguments');
  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('def: first argument must be a symbol');
  const value = await evalExpr(args[1], ctx);
  ctx.env = envSet(ctx.env, nameNode.name, value);
  return value;
});

/** (fn (params...) body) — create a closure */
registerSpecial('fn', async (args, ctx, _evalExpr) => {
  if (args.length !== 2) throw new Error('fn requires exactly 2 arguments: (fn (params...) body)');
  const paramList = args[0];
  if (paramList.type !== 'list') throw new Error('fn: first argument must be a parameter list');
  const params: string[] = [];
  for (const p of paramList.elements) {
    if (p.type !== 'symbol') throw new Error('fn: parameters must be symbols');
    params.push(p.name);
  }
  // Store the body AST as-is; we'll eval it on call.
  // We need to store the AST node, but Closure.body is AlgValue.
  // We'll use a tagged wrapper to carry AST through the value system.
  return {
    kind: 'closure' as const,
    env: ctx.env,
    params,
    body: { kind: 'atom' as const, value: '__ast_placeholder__', isSymbol: false },
    // Attach AST as an extra property — apply.ts will check for it
    _bodyAst: args[1],
  } as any;
});

/** (let ((name val)...) body) — sequential bindings, eval body in extended env */
registerSpecial('let', async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('let requires exactly 2 arguments: (let ((name val)...) body)');
  const bindingsList = args[0];
  if (bindingsList.type !== 'list') throw new Error('let: first argument must be a bindings list');

  let env = ctx.env;
  for (const binding of bindingsList.elements) {
    if (binding.type !== 'list' || binding.elements.length !== 2) {
      throw new Error('let: each binding must be (name value)');
    }
    const nameNode = binding.elements[0];
    if (nameNode.type !== 'symbol') throw new Error('let: binding name must be a symbol');
    const val = await evalExpr(binding.elements[1], { ...ctx, env });
    env = envSet(env, nameNode.name, val);
  }

  return evalExpr(args[1], { ...ctx, env });
});

/** (do expr...) — evaluate each, return last */
registerSpecial('do', async (args, ctx, evalExpr) => {
  if (args.length === 0) return mkSym('nil');
  let result: AlgValue = mkSym('nil');
  for (const expr of args) {
    result = await evalExpr(expr, ctx);
  }
  return result;
});

/**
 * (if condition then-branch else-branch)
 *
 * THE CRITICAL SPECIAL FORM: contradiction-producing conditional.
 * - Coerce condition to verdict bits
 * - T bit set → eval then-branch
 * - F bit set → eval else-branch
 * - Both bits → eval BOTH branches, return Contra
 * - Neither bits → return Hypothesis with "underdetermined" debt
 */
registerSpecial('if', async (args, ctx, evalExpr) => {
  if (args.length < 2 || args.length > 3) {
    throw new Error('if requires 2 or 3 arguments: (if cond then [else])');
  }

  const condVal = await evalExpr(args[0], ctx);

  // Coerce condition to verdict bits
  let bits: number;
  if (condVal.kind === 'verdict') {
    bits = condVal.bits;
  } else if (condVal.kind === 'contra') {
    // Contra condition → Both (it has both a positive and negative derivation)
    bits = BOTH;
  } else if (condVal.kind === 'atom') {
    // Truthy/falsy: false = symbol 'false' or number 0 or symbol 'nil'
    if (condVal.isSymbol && (condVal.value === 'false' || condVal.value === 'nil')) {
      bits = FALSE;
    } else if (!condVal.isSymbol && condVal.value === 0) {
      bits = FALSE;
    } else {
      bits = TRUE;
    }
  } else {
    // All other values are truthy
    bits = TRUE;
  }

  const hasThen = args.length >= 2;
  const hasElse = args.length >= 3;
  const tBit = (bits & 1) !== 0;
  const fBit = (bits & 2) !== 0;

  if (tBit && fBit) {
    // Both — eval both branches, return Contra
    const thenVal = await evalExpr(args[1], ctx);
    const elseVal = hasElse ? await evalExpr(args[2], ctx) : mkSym('nil');
    return mkContra(thenVal, elseVal, condVal, condVal, 1.0, 'if');
  } else if (tBit) {
    // True only
    return evalExpr(args[1], ctx);
  } else if (fBit) {
    // False only
    return hasElse ? evalExpr(args[2], ctx) : mkSym('nil');
  } else {
    // Neither — underdetermined
    return mkHypothesis(mkSym('nil'), [], 'underdetermined');
  }
});

/** (quote expr) — return the AST as an AlgValue */
registerSpecial('quote', async (args, _ctx, _evalExpr) => {
  if (args.length !== 1) throw new Error('quote requires exactly 1 argument');
  return astToValue(args[0]);
});

/** Convert an AST node to an AlgValue (for quote). */
function astToValue(node: ASTNode): AlgValue {
  switch (node.type) {
    case 'number': return mkNum(node.value);
    case 'string': return mkStr(node.value);
    case 'symbol': return mkSym(node.name);
    case 'list': return mkList(node.elements.map(astToValue));
  }
}
