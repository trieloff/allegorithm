/**
 * Public API for the Allegorithm evaluator.
 */

export { evalExpr } from './eval.js';
export { mkContext, type EvalContext, type EvidenceDB } from './context.js';
export { envLookup, envSet } from './env.js';
export { registerSpecial, getSpecial, type SpecialHandler, type EvalFn } from './specials.js';
export { getBuiltin, preludeBindings, builtins } from './prelude.js';
export { applyClosure } from './apply.js';
