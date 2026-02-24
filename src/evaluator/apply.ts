/**
 * Function application — apply a closure or built-in to arguments.
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue, Closure } from '../types/index.js';
import type { EvalContext } from './context.js';
import type { EvalFn } from './specials.js';
import { extendEnv } from '../types/index.js';

/**
 * Apply a closure to evaluated arguments.
 *
 * Extends the closure's captured environment with param → arg bindings,
 * then evaluates the body in that extended environment.
 */
export async function applyClosure(
  closure: Closure,
  args: AlgValue[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== closure.params.length) {
    throw new Error(
      `Expected ${closure.params.length} arguments, got ${args.length}`,
    );
  }

  const bindings = new Map<string, AlgValue>();
  for (let i = 0; i < closure.params.length; i++) {
    bindings.set(closure.params[i], args[i]);
  }

  const callEnv = extendEnv(closure.env, bindings);

  // The body AST is stored as _bodyAst on the closure (see specials.ts fn handler)
  const bodyAst = (closure as any)._bodyAst as ASTNode;
  if (!bodyAst) {
    throw new Error('Closure has no body AST — this is a bug');
  }

  return evalExpr(bodyAst, { ...ctx, env: callEnv });
}
