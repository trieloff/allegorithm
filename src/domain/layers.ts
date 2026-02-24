/**
 * Layer/stack composition — matryoshka nesting primitives.
 *
 * Provides deflayer, defstack, doll, hdr, payload, wrap, unwrap, and require
 * special forms for layered encapsulation (network stacks, protocol layers, etc.).
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from '../evaluator/context.js';
import type { EvalFn, SpecialHandler } from '../evaluator/specials.js';
import { mkSym, mkList, mkVerdict, mkStr, TRUE, FALSE } from '../types/index.js';
import { mkContra } from '../types/contra.js';
import { envSet } from '../evaluator/env.js';
import { applyClosure } from '../evaluator/apply.js';

// ── Runtime representations ──────────────────────────────────────────
// Layers, stacks, and dolls are encoded as AlgList with a tag marker,
// so they flow through the existing value system without extending the union.

const LAYER_TAG = '__layer__';
const STACK_TAG = '__stack__';
const DOLL_TAG = '__doll__';

/** Encode a layer as an AlgList: (tag name wrapClosure unwrapClosure) */
function mkLayer(name: string, wrapFn: AlgValue, unwrapFn: AlgValue): AlgValue {
  return mkList([mkSym(LAYER_TAG), mkStr(name), wrapFn, unwrapFn]);
}

/** Encode a stack as an AlgList: (tag name layer1 layer2 ...) */
function mkStack(name: string, layers: readonly AlgValue[]): AlgValue {
  return mkList([mkSym(STACK_TAG), mkStr(name), ...layers]);
}

/** Encode a doll as an AlgList: (tag tagSym headerList payload) */
function mkDoll(tag: AlgValue, header: AlgValue, payload: AlgValue): AlgValue {
  return mkList([mkSym(DOLL_TAG), tag, header, payload]);
}

function isLayer(v: AlgValue): boolean {
  return v.kind === 'list' && v.items.length >= 4
    && v.items[0].kind === 'atom' && v.items[0].isSymbol && v.items[0].value === LAYER_TAG;
}

function isStack(v: AlgValue): boolean {
  return v.kind === 'list' && v.items.length >= 2
    && v.items[0].kind === 'atom' && v.items[0].isSymbol && v.items[0].value === STACK_TAG;
}

function isDoll(v: AlgValue): boolean {
  return v.kind === 'list' && v.items.length === 4
    && v.items[0].kind === 'atom' && v.items[0].isSymbol && v.items[0].value === DOLL_TAG;
}

function layerWrapFn(layer: AlgValue): AlgValue {
  if (layer.kind !== 'list') throw new Error('layerWrapFn: not a layer');
  return layer.items[2];
}

function layerUnwrapFn(layer: AlgValue): AlgValue {
  if (layer.kind !== 'list') throw new Error('layerUnwrapFn: not a layer');
  return layer.items[3];
}

function stackLayers(stack: AlgValue): AlgValue[] {
  if (stack.kind !== 'list') throw new Error('stackLayers: not a stack');
  return stack.items.slice(2);
}

// ── Special form handlers ────────────────────────────────────────────

/**
 * (deflayer name (wrap (fn (p) body)) (unwrap (fn (d) body)))
 *
 * Defines a layer with wrap/unwrap closures and binds it in the env.
 */
export const handleDeflayer: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 3) throw new Error('deflayer requires 3 arguments: (deflayer name (wrap fn) (unwrap fn))');

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('deflayer: first argument must be a symbol');
  const name = nameNode.name;

  // Parse (wrap <fn>) and (unwrap <fn>)
  const wrapArg = args[1];
  const unwrapArg = args[2];

  if (wrapArg.type !== 'list' || wrapArg.elements.length !== 2)
    throw new Error('deflayer: second argument must be (wrap <fn>)');
  if (wrapArg.elements[0].type !== 'symbol' || wrapArg.elements[0].name !== 'wrap')
    throw new Error('deflayer: second argument must start with wrap');

  if (unwrapArg.type !== 'list' || unwrapArg.elements.length !== 2)
    throw new Error('deflayer: third argument must be (unwrap <fn>)');
  if (unwrapArg.elements[0].type !== 'symbol' || unwrapArg.elements[0].name !== 'unwrap')
    throw new Error('deflayer: third argument must start with unwrap');

  const wrapFn = await evalExpr(wrapArg.elements[1], ctx);
  const unwrapFn = await evalExpr(unwrapArg.elements[1], ctx);

  if (wrapFn.kind !== 'closure') throw new Error('deflayer: wrap function must be a closure');
  if (unwrapFn.kind !== 'closure') throw new Error('deflayer: unwrap function must be a closure');

  const layer = mkLayer(name, wrapFn, unwrapFn);
  ctx.env = envSet(ctx.env, name, layer);
  return layer;
};

/**
 * (defstack name (list layer1 layer2 ...))
 *
 * Composes layers into a named stack and binds it.
 */
export const handleDefstack: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('defstack requires 2 arguments: (defstack name layers-expr)');

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('defstack: first argument must be a symbol');
  const name = nameNode.name;

  const layersVal = await evalExpr(args[1], ctx);
  if (layersVal.kind !== 'list') throw new Error('defstack: second argument must evaluate to a list of layers');

  for (const l of layersVal.items) {
    if (!isLayer(l)) throw new Error('defstack: all items must be layers');
  }

  const stack = mkStack(name, layersVal.items);
  ctx.env = envSet(ctx.env, name, stack);
  return stack;
};

/**
 * (doll tag header payload)
 *
 * Constructs a doll. tag is a symbol, header is a list of key-value pairs, payload is any value.
 */
export const handleDoll: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 3) throw new Error('doll requires 3 arguments: (doll tag header payload)');

  // Tag is a keyword symbol (e.g. :L2) — quote it, don't evaluate
  const tagNode = args[0];
  const tag = tagNode.type === 'symbol' ? mkSym(tagNode.name) : await evalExpr(tagNode, ctx);
  const header = await evalExpr(args[1], ctx);
  const payload = await evalExpr(args[2], ctx);

  return mkDoll(tag, header, payload);
};

/**
 * (hdr doll key)
 *
 * Extracts a header field by keyword name from a doll.
 */
export const handleHdr: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('hdr requires 2 arguments: (hdr doll key)');

  const dollVal = await evalExpr(args[0], ctx);
  // Key is a keyword symbol (e.g. :mtu) — quote it, don't evaluate
  const keyNode = args[1];
  const key = keyNode.type === 'symbol' ? mkSym(keyNode.name) : await evalExpr(keyNode, ctx);

  if (!isDoll(dollVal)) throw new Error('hdr: first argument must be a doll');
  if (dollVal.kind !== 'list') throw new Error('hdr: unexpected');

  const header = dollVal.items[2]; // header is at index 2
  if (header.kind !== 'list') throw new Error('hdr: doll header must be a list');

  // Key is a symbol like :mtu — search through header pairs
  const keyStr = key.kind === 'atom' ? String(key.value) : '';

  for (const pair of header.items) {
    if (pair.kind === 'list' && pair.items.length >= 2) {
      const pairKey = pair.items[0];
      if (pairKey.kind === 'atom' && String(pairKey.value) === keyStr) {
        return pair.items[1];
      }
    }
  }

  return mkSym('nil');
};

/**
 * (payload doll)
 *
 * Extracts the payload from a doll.
 */
export const handlePayload: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 1) throw new Error('payload requires 1 argument: (payload doll)');

  const dollVal = await evalExpr(args[0], ctx);

  if (!isDoll(dollVal)) throw new Error('payload: argument must be a doll');
  if (dollVal.kind !== 'list') throw new Error('payload: unexpected');

  return dollVal.items[3]; // payload is at index 3
};

/**
 * (wrap stack payload)
 *
 * Applies all layers bottom-to-top, each wrapping the previous result.
 */
export const handleWrap: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('wrap requires 2 arguments: (wrap stack payload)');

  const stackVal = await evalExpr(args[0], ctx);
  let current = await evalExpr(args[1], ctx);

  if (!isStack(stackVal)) throw new Error('wrap: first argument must be a stack');

  const layers = stackLayers(stackVal);

  // Apply layers bottom-to-top (first layer in list = bottom)
  for (const layer of layers) {
    const wrapFn = layerWrapFn(layer);
    if (wrapFn.kind !== 'closure') throw new Error('wrap: layer wrap function must be a closure');
    current = await applyClosure(wrapFn, [current], ctx, evalExpr as any);
  }

  return current;
};

/**
 * (unwrap stack doll)
 *
 * Strips all layers top-to-bottom, each unwrapping the previous result.
 * Guard failures produce Contra/Verdict, not exceptions.
 */
export const handleUnwrap: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 2) throw new Error('unwrap requires 2 arguments: (unwrap stack doll)');

  const stackVal = await evalExpr(args[0], ctx);
  let current = await evalExpr(args[1], ctx);

  if (!isStack(stackVal)) throw new Error('unwrap: first argument must be a stack');

  const layers = stackLayers(stackVal);

  // Apply layers top-to-bottom (reverse order)
  for (let i = layers.length - 1; i >= 0; i--) {
    const unwrapFn = layerUnwrapFn(layers[i]);
    if (unwrapFn.kind !== 'closure') throw new Error('unwrap: layer unwrap function must be a closure');
    current = await applyClosure(unwrapFn, [current], ctx, evalExpr as any);
  }

  return current;
};

/**
 * (require condition)
 *
 * Guard form that evaluates its condition and returns a Verdict.
 * If the condition is false/neither, returns a Verdict with FALSE bits
 * (or wraps in a Contra if needed). Does NOT throw.
 */
export const handleRequire: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 1) throw new Error('require requires 1 argument: (require condition)');

  const condVal = await evalExpr(args[0], ctx);

  // Coerce to verdict
  if (condVal.kind === 'verdict') {
    return condVal;
  }

  if (condVal.kind === 'contra') {
    // Contradiction in guard — return it as-is (it's already a contradiction)
    return condVal;
  }

  if (condVal.kind === 'atom') {
    if (condVal.isSymbol && (condVal.value === 'false' || condVal.value === 'nil')) {
      return mkVerdict(FALSE, [mkStr('require: guard failed')]);
    }
    if (!condVal.isSymbol && condVal.value === 0) {
      return mkVerdict(FALSE, [mkStr('require: guard failed')]);
    }
    return mkVerdict(TRUE);
  }

  // All other truthy values
  return mkVerdict(TRUE);
};

// ── Predicate builtins ───────────────────────────────────────────────

export function isDollValue(args: AlgValue[]): AlgValue {
  if (args.length !== 1) throw new Error('doll?: requires 1 argument');
  return mkVerdict(isDoll(args[0]) ? TRUE : FALSE);
}

export function isLayerValue(args: AlgValue[]): AlgValue {
  if (args.length !== 1) throw new Error('layer?: requires 1 argument');
  return mkVerdict(isLayer(args[0]) ? TRUE : FALSE);
}

export function isStackValue(args: AlgValue[]): AlgValue {
  if (args.length !== 1) throw new Error('stack?: requires 1 argument');
  return mkVerdict(isStack(args[0]) ? TRUE : FALSE);
}
