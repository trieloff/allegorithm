/**
 * Allegorithm — public API and integration layer.
 *
 * This module wires up all special forms (evidence, readings, court, oracle)
 * and provides the `run()` convenience function.
 */

// ── Trigger side-effect registrations ────────────────────────────────
// Court and oracle specials register themselves on import.
import './evaluator/court-specials.js';
import './evaluator/oracle-specials.js';
import './evaluator/side-effects.js';

// ── Wire up evidence specials ────────────────────────────────────────
import { registerSpecial } from './evaluator/specials.js';
import {
  handleClaim, handleAffirm, handleDeny, handleMeaning, handleResolve,
} from './evaluator/evidence-specials.js';

registerSpecial('claim', handleClaim);
registerSpecial('affirm', handleAffirm);
registerSpecial('deny', handleDeny);
registerSpecial('meaning', handleMeaning);
registerSpecial('resolve', handleResolve);

// ── Wire up readings specials ────────────────────────────────────────
import {
  handleDeffable, handleDefreading, handleWithReading,
  handlePolyread, handleAllegorize,
} from './evaluator/readings-specials.js';

registerSpecial('deffable', async (args, ctx, evalExpr) =>
  handleDeffable(args, ctx, (node, c) => evalExpr(node, c)));

registerSpecial('defreading', async (args, ctx, evalExpr) =>
  handleDefreading(args, ctx, (node, c) => evalExpr(node, c)));

registerSpecial('with-reading', async (args, ctx, evalExpr) =>
  handleWithReading(args, ctx, (node, c) => evalExpr(node, c)));

registerSpecial('polyread', async (args, ctx, evalExpr) =>
  handlePolyread(args, ctx, (node, c) => evalExpr(node, c)));

registerSpecial('allegorize', async (args, ctx, evalExpr) =>
  handleAllegorize(args, ctx, (node, c) => evalExpr(node, c)));

// ── Wire up layer/stack/doll specials ─────────────────────────────────
import {
  handleDeflayer, handleDefstack, handleDoll,
  handleHdr, handlePayload,
  handleWrap, handleUnwrap, handleRequire,
} from './domain/layers.js';

registerSpecial('deflayer', handleDeflayer);
registerSpecial('defstack', handleDefstack);
registerSpecial('doll', handleDoll);
registerSpecial('hdr', handleHdr);
registerSpecial('payload', handlePayload);
registerSpecial('wrap', handleWrap);
registerSpecial('unwrap', handleUnwrap);
registerSpecial('require', handleRequire);

// ── Wire up event/state specials ─────────────────────────────────────
import {
  handleState, handleStateSegments, handleStateNth, handleStateCount,
} from './domain/state.js';
import {
  handleRule, handleTransfer, handleEmbed,
  handleOn, handleEmit, handleInvariant, handleCheckInvariants,
  handleMakeSegment, handleGetField, handleSumField,
} from './domain/events.js';

registerSpecial('state', handleState);
registerSpecial('state-segments', handleStateSegments);
registerSpecial('state-nth', handleStateNth);
registerSpecial('state-count', handleStateCount);
registerSpecial('rule', handleRule);
registerSpecial('transfer', handleTransfer);
registerSpecial('embed', handleEmbed);
registerSpecial('on', handleOn);
registerSpecial('emit', handleEmit);
registerSpecial('invariant', handleInvariant);
registerSpecial('check-invariants', handleCheckInvariants);
registerSpecial('make-segment', handleMakeSegment);
registerSpecial('get-field', handleGetField);
registerSpecial('sum-field', handleSumField);

// ── Wire up Lagrangian/moral specials ────────────────────────────────
import {
  handleDeflagrangian, handleSimulateLagrangian,
} from './domain/lagrangian.js';
import {
  handleMoral, handleCheckConservation,
} from './domain/moral.js';

registerSpecial('deflagrangian', handleDeflagrangian);
registerSpecial('simulate-lagrangian', handleSimulateLagrangian);
registerSpecial('moral', handleMoral);
registerSpecial('check-conservation', handleCheckConservation);

// ── Re-exports ───────────────────────────────────────────────────────
export { parse } from './parser/index.js';
export { evalExpr } from './evaluator/eval.js';
export { mkContext } from './evaluator/context.js';
export type { EvalContext } from './evaluator/context.js';
export { preludeBindings } from './evaluator/prelude.js';
export { extendEnv, emptyEnv } from './types/index.js';
export type { AlgValue } from './types/index.js';
export { printValue, prettyPrint } from './printer/printer.js';

// ── Convenience runner ───────────────────────────────────────────────

import { parse } from './parser/index.js';
import { evalExpr } from './evaluator/eval.js';
import { mkContext } from './evaluator/context.js';
import type { EvalContext } from './evaluator/context.js';
import { preludeBindings } from './evaluator/prelude.js';
import { extendEnv, emptyEnv } from './types/index.js';
import type { AlgValue } from './types/index.js';

/**
 * Parse and evaluate all forms in a source string.
 * Returns the result of the last form.
 */
export async function run(source: string, ctx?: EvalContext): Promise<AlgValue> {
  const ast = parse(source);
  const evalCtx = ctx ?? mkContext({
    env: extendEnv(emptyEnv(), preludeBindings()),
  });
  let result: AlgValue = { kind: 'atom', value: 'nil', isSymbol: true };
  for (const node of ast) {
    result = await evalExpr(node, evalCtx);
  }
  return result;
}

/**
 * Create a fresh evaluation context with prelude bindings.
 */
export function mkDefaultContext(): EvalContext {
  return mkContext({
    env: extendEnv(emptyEnv(), preludeBindings()),
  });
}
