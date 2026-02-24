/**
 * Oracle special form handler for the evaluator.
 *
 * (oracle :task T :input I :schema S :issuer A) → Hypothesis
 *
 * Parses keyword arguments from AST, calls the oracle client
 * from the eval context, and returns a Hypothesis.
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import { mkStr, mkSym } from '../types/index.js';
import type { EvalContext } from './context.js';
import type { EvalFn } from './specials.js';
import { registerSpecial } from './specials.js';
import { callOracle } from '../oracle/oracle.js';

/**
 * Parse keyword arguments from AST node list.
 * Keywords are SymbolNodes starting with ":".
 * Returns a map from keyword name (without ":") to the next AST node.
 */
function parseKeywordArgs(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): { keywords: Map<string, ASTNode>; positional: ASTNode[] } {
  const keywords = new Map<string, ASTNode>();
  const positional: ASTNode[] = [];
  let i = 0;

  while (i < args.length) {
    const node = args[i];
    if (node.type === 'symbol' && node.name.startsWith(':')) {
      const key = node.name.slice(1); // remove leading ":"
      if (i + 1 < args.length) {
        keywords.set(key, args[i + 1]);
        i += 2;
      } else {
        throw new Error(`oracle: keyword :${key} has no value`);
      }
    } else {
      positional.push(node);
      i++;
    }
  }

  return { keywords, positional };
}

/**
 * Extract a string from an evaluated AlgValue.
 */
function algToString(val: AlgValue): string {
  if (val.kind === 'atom') return String(val.value);
  return JSON.stringify(val);
}

/**
 * Extract a JS value from an evaluated AlgValue for use as oracle input.
 */
function algToJS(val: AlgValue): any {
  if (val.kind === 'atom') return val.value;
  if (val.kind === 'list') return val.items.map(algToJS);
  return val;
}

/**
 * Handle the oracle special form:
 * (oracle :task T :input I :schema S :issuer A)
 */
export async function handleOracle(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (!ctx.oracle) {
    throw new Error('oracle: no oracle function configured in eval context');
  }

  const { keywords } = parseKeywordArgs(args, ctx, evalExpr);

  // Evaluate keyword values
  const taskNode = keywords.get('task');
  const inputNode = keywords.get('input');
  const schemaNode = keywords.get('schema');
  const issuerNode = keywords.get('issuer');

  if (!taskNode) {
    throw new Error('oracle: :task keyword is required');
  }

  const taskVal = await evalExpr(taskNode, ctx);
  const task = algToString(taskVal);

  const input = inputNode ? algToJS(await evalExpr(inputNode, ctx)) : null;
  const schema = schemaNode ? algToJS(await evalExpr(schemaNode, ctx)) : null;
  const issuer = issuerNode ? algToString(await evalExpr(issuerNode, ctx)) : 'anonymous';

  return callOracle(ctx.oracle, task, input, schema, issuer);
}

// Register the oracle special form
registerSpecial('oracle', handleOracle);
