/**
 * Event/rule system for the Allegorithm simulation layer.
 *
 * Special forms:
 *   (rule name (params) body)        — define a named event rule
 *   (transfer source field -> target field :fraction α) — field transfer
 *   (embed entity inside container)  — nest entity inside a container's segments
 *   (on event-name handler)          — register event listener
 *   (emit (rule-name args...))       — dispatch event, triggers handlers
 *   (invariant expr)                 — declare conservation check
 *   (check-invariants)               — run all invariants, return verdict
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from '../evaluator/context.js';
import type { EvalFn } from '../evaluator/specials.js';
import { mkList, mkSym, mkNum, mkVerdict, TRUE, FALSE } from '../types/index.js';
import { envSet, envLookup } from '../evaluator/env.js';
import { extendEnv } from '../types/index.js';
import { resolveState } from './state.js';

// ── Rule storage ─────────────────────────────────────────────────────

/** A defined rule: named callable with params and body AST. */
interface Rule {
  name: string;
  params: string[];
  /** keyword params with defaults: e.g. :fraction 0.5 */
  kwParams: Map<string, AlgValue>;
  body: ASTNode[];
}

/** Per-context storage key for rules, handlers, and invariants. */
const RULES_KEY = '__event_rules__';
const HANDLERS_KEY = '__event_handlers__';
const INVARIANTS_KEY = '__event_invariants__';
const DISPATCH_DEPTH_KEY = '__dispatch_depth__';
const MAX_DISPATCH_DEPTH = 100;

/** Get or create the rules map from context options. */
function getRules(ctx: EvalContext): Map<string, Rule> {
  if (!ctx.options[RULES_KEY]) ctx.options[RULES_KEY] = new Map<string, Rule>();
  return ctx.options[RULES_KEY];
}

/** Get or create the handlers map from context options. */
function getHandlers(ctx: EvalContext): Map<string, Array<{ handler: AlgValue }>> {
  if (!ctx.options[HANDLERS_KEY]) ctx.options[HANDLERS_KEY] = new Map<string, Array<{ handler: AlgValue }>>();
  return ctx.options[HANDLERS_KEY];
}

/** Get or create the invariants list from context options. */
function getInvariants(ctx: EvalContext): Array<{ expr: ASTNode }> {
  if (!ctx.options[INVARIANTS_KEY]) ctx.options[INVARIANTS_KEY] = [];
  return ctx.options[INVARIANTS_KEY];
}

function getDispatchDepth(ctx: EvalContext): number {
  return ctx.options[DISPATCH_DEPTH_KEY] ?? 0;
}

function setDispatchDepth(ctx: EvalContext, depth: number): void {
  ctx.options[DISPATCH_DEPTH_KEY] = depth;
}

// ── Helper: extract field from a list-based record ───────────────────

/**
 * Records are lists like (make-segment :name "a" :mass 10).
 * Field access: find the keyword, return the value after it.
 */
function getField(record: AlgValue, fieldName: string): AlgValue | undefined {
  if (record.kind !== 'list') return undefined;
  const key = `:${fieldName}`;
  for (let i = 0; i < record.items.length; i++) {
    const item = record.items[i];
    if (item.kind === 'atom' && item.isSymbol && item.value === key) {
      return record.items[i + 1];
    }
  }
  return undefined;
}

/**
 * Set a field in a list-based record, returning a new list.
 */
function setField(record: AlgValue, fieldName: string, newValue: AlgValue): AlgValue {
  if (record.kind !== 'list') throw new Error(`setField: expected list record`);
  const key = `:${fieldName}`;
  const items = [...record.items];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'atom' && item.isSymbol && item.value === key) {
      items[i + 1] = newValue;
      return mkList(items);
    }
  }
  // Field doesn't exist, append
  items.push(mkSym(key), newValue);
  return mkList(items);
}

// ── Special form handlers ────────────────────────────────────────────

/**
 * (rule name (params...) body...)
 *
 * Params can include keyword args: (predator prey :fraction 0.5)
 * The keyword and its default are stored separately.
 */
export async function handleRule(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length < 3) throw new Error('rule: requires name, params, and body');

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('rule: name must be a symbol');

  const paramList = args[1];
  if (paramList.type !== 'list') throw new Error('rule: second argument must be a parameter list');

  const params: string[] = [];
  const kwParams = new Map<string, AlgValue>();

  let i = 0;
  while (i < paramList.elements.length) {
    const p = paramList.elements[i];
    if (p.type !== 'symbol') throw new Error('rule: parameters must be symbols');
    const name = p.name;
    if (name.startsWith(':')) {
      // Keyword param with default value
      i++;
      if (i >= paramList.elements.length) {
        throw new Error(`rule: keyword param ${name} requires a default value`);
      }
      const defaultVal = await evalExpr(paramList.elements[i], ctx);
      kwParams.set(name, defaultVal);
    } else {
      params.push(name);
    }
    i++;
  }

  const body = args.slice(2);
  const rule: Rule = { name: nameNode.name, params, kwParams, body };
  getRules(ctx).set(nameNode.name, rule);

  return mkSym(nameNode.name);
}

/**
 * (transfer source :field -> target :field :fraction α)
 *
 * Transfers fraction α of source's field value to target's field.
 * Both source and target can be state container segments or direct values.
 * The transfer is mutation-based when operating on state container segments.
 *
 * Syntax: (transfer source :mass -> target :mass :fraction 0.5)
 */
export async function handleTransfer(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  // Parse: source :srcField -> target :tgtField :fraction α
  if (args.length < 6) throw new Error('transfer: requires source :field -> target :field :fraction α');

  const source = await evalExpr(args[0], ctx);

  const srcFieldNode = args[1];
  if (srcFieldNode.type !== 'symbol' || !srcFieldNode.name.startsWith(':')) {
    throw new Error('transfer: expected source field keyword (e.g. :mass)');
  }
  const srcField = srcFieldNode.name.slice(1);

  const arrowNode = args[2];
  if (arrowNode.type !== 'symbol' || arrowNode.name !== '->') {
    throw new Error('transfer: expected -> between source and target');
  }

  const target = await evalExpr(args[3], ctx);

  const tgtFieldNode = args[4];
  if (tgtFieldNode.type !== 'symbol' || !tgtFieldNode.name.startsWith(':')) {
    throw new Error('transfer: expected target field keyword');
  }
  const tgtField = tgtFieldNode.name.slice(1);

  // Parse keyword args (:fraction)
  let fraction = 1.0;
  let i = 5;
  while (i < args.length) {
    const kw = args[i];
    if (kw.type === 'symbol' && kw.name === ':fraction') {
      i++;
      const fracVal = await evalExpr(args[i], ctx);
      if (fracVal.kind !== 'atom' || typeof fracVal.value !== 'number') {
        throw new Error('transfer: :fraction must be a number');
      }
      fraction = fracVal.value;
    }
    i++;
  }

  // Get source field value
  const srcFieldVal = getField(source, srcField);
  if (!srcFieldVal || srcFieldVal.kind !== 'atom' || typeof srcFieldVal.value !== 'number') {
    throw new Error(`transfer: source field :${srcField} must be numeric`);
  }

  // Get target field value
  const tgtFieldVal = getField(target, tgtField);
  if (!tgtFieldVal || tgtFieldVal.kind !== 'atom' || typeof tgtFieldVal.value !== 'number') {
    throw new Error(`transfer: target field :${tgtField} must be numeric`);
  }

  const amount = srcFieldVal.value * fraction;
  const newSrcVal = srcFieldVal.value - amount;
  const newTgtVal = tgtFieldVal.value + amount;

  // Apply mutation to state containers if the entities are in state segments
  const newSource = setField(source, srcField, mkNum(newSrcVal));
  const newTarget = setField(target, tgtField, mkNum(newTgtVal));

  // Try to update state containers in-place
  mutateSegment(ctx, source, newSource);
  mutateSegment(ctx, target, newTarget);

  return mkList([newSource, newTarget]);
}

/** Try to find and replace a segment in any state container. */
function mutateSegment(ctx: EvalContext, oldSeg: AlgValue, newSeg: AlgValue): boolean {
  // Walk all state containers looking for this segment
  // Match by identity (same object) or by matching :name field
  const oldName = getField(oldSeg, 'name');

  // Check all bindings in the environment for state refs
  let env = ctx.env;
  while (env) {
    for (const [, val] of env.bindings) {
      const container = resolveState(val);
      if (container) {
        for (let i = 0; i < container.segments.length; i++) {
          const seg = container.segments[i];
          if (seg === oldSeg) {
            container.segments[i] = newSeg;
            return true;
          }
          // Match by :name field
          if (oldName && oldName.kind === 'atom') {
            const segName = getField(seg, 'name');
            if (segName && segName.kind === 'atom' && segName.value === oldName.value) {
              container.segments[i] = newSeg;
              return true;
            }
          }
        }
      }
    }
    env = env.parent!;
    if (!env) break;
  }
  return false;
}

/**
 * (embed entity inside container)
 *
 * Adds entity as a child of the container. For cycle containers,
 * the entity is appended to segments.
 */
export async function handleEmbed(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 3) throw new Error('embed: requires (embed entity inside container)');

  const entity = await evalExpr(args[0], ctx);

  const insideNode = args[1];
  if (insideNode.type !== 'symbol' || insideNode.name !== 'inside') {
    throw new Error('embed: expected "inside" keyword');
  }

  const containerRef = await evalExpr(args[2], ctx);
  const container = resolveState(containerRef);
  if (!container) throw new Error('embed: third argument must be a state container');

  // For list-based records, check if entity has a :name and mark it as embedded
  // by adding :embedded-in field. Also, modify the container to note embedding.
  const entityName = getField(entity, 'name');

  // Find and remove the entity from the container's segments (it's being embedded)
  if (entityName && entityName.kind === 'atom') {
    const idx = container.segments.findIndex(seg => {
      const segName = getField(seg, 'name');
      return segName && segName.kind === 'atom' && segName.value === entityName.value;
    });
    if (idx !== -1) {
      // Remove from top-level segments — it's now embedded
      container.segments.splice(idx, 1);
    }
  }

  // Find the target segment (the container argument might be the state itself
  // or we store it as a child list)
  // For simplicity: add to a special :children field on the container state
  if (!container.segments.find(s => s.kind === 'atom' && s.isSymbol && s.value === '__children__')) {
    // Store embedded entities in options
  }
  if (!ctx.options.__embedded__) ctx.options.__embedded__ = [];
  ctx.options.__embedded__.push({ entity, container: containerRef });

  return mkSym('nil');
}

/**
 * (on event-name handler)
 *
 * Registers a handler (closure or quoted expression) to be called
 * when the named event is emitted.
 */
export async function handleOn(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 2) throw new Error('on: requires event-name and handler');

  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('on: event name must be a symbol');

  const handler = await evalExpr(args[1], ctx);
  const handlers = getHandlers(ctx);
  if (!handlers.has(nameNode.name)) handlers.set(nameNode.name, []);
  handlers.get(nameNode.name)!.push({ handler });

  return mkSym('nil');
}

/**
 * (emit (rule-name args...))
 *
 * Dispatches an event by invoking the named rule and any registered handlers.
 * Tracks recursion depth to prevent infinite re-entrant dispatch.
 */
export async function handleEmit(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('emit: requires exactly 1 argument (event form)');

  const eventForm = args[0];
  if (eventForm.type !== 'list' || eventForm.elements.length < 1) {
    throw new Error('emit: argument must be a list (rule-name args...)');
  }

  const depth = getDispatchDepth(ctx);
  if (depth >= MAX_DISPATCH_DEPTH) {
    throw new Error(`emit: dispatch depth exceeded ${MAX_DISPATCH_DEPTH} — possible infinite recursion`);
  }
  setDispatchDepth(ctx, depth + 1);

  try {
    const ruleNameNode = eventForm.elements[0];
    if (ruleNameNode.type !== 'symbol') throw new Error('emit: event rule name must be a symbol');
    const ruleName = ruleNameNode.name;

    // Evaluate the arguments
    const eventArgs: AlgValue[] = [];
    for (let i = 1; i < eventForm.elements.length; i++) {
      eventArgs.push(await evalExpr(eventForm.elements[i], ctx));
    }

    // Look up and execute the rule
    const rules = getRules(ctx);
    const rule = rules.get(ruleName);
    let result: AlgValue = mkSym('nil');

    if (rule) {
      // Bind positional params
      if (eventArgs.length < rule.params.length) {
        throw new Error(`emit: rule "${ruleName}" expects ${rule.params.length} args, got ${eventArgs.length}`);
      }

      let ruleEnv = ctx.env;
      for (let i = 0; i < rule.params.length; i++) {
        ruleEnv = envSet(ruleEnv, rule.params[i], eventArgs[i]);
      }

      // Bind keyword params from remaining args or defaults
      let argIdx = rule.params.length;
      const kwUsed = new Set<string>();
      while (argIdx < eventArgs.length) {
        const kw = eventArgs[argIdx];
        if (kw.kind === 'atom' && kw.isSymbol && typeof kw.value === 'string' && (kw.value as string).startsWith(':')) {
          argIdx++;
          if (argIdx < eventArgs.length) {
            kwUsed.add(kw.value as string);
            ruleEnv = envSet(ruleEnv, (kw.value as string).slice(1), eventArgs[argIdx]);
          }
          argIdx++;
        } else {
          argIdx++;
        }
      }
      // Apply defaults for unused keyword params
      for (const [kw, defaultVal] of rule.kwParams) {
        if (!kwUsed.has(kw)) {
          ruleEnv = envSet(ruleEnv, kw.slice(1), defaultVal);
        }
      }

      // Execute rule body
      const ruleCtx = { ...ctx, env: ruleEnv };
      for (const bodyExpr of rule.body) {
        result = await evalExpr(bodyExpr, ruleCtx);
      }
    }

    // Fire registered handlers
    const handlers = getHandlers(ctx);
    const eventHandlers = handlers.get(ruleName);
    if (eventHandlers) {
      for (const { handler } of eventHandlers) {
        if (handler.kind === 'closure') {
          // Call handler with event args
          const { applyClosure } = await import('../evaluator/apply.js');
          const handlerArgs = eventArgs.length > 0 ? eventArgs : [mkSym(ruleName)];
          // Only pass as many args as the closure expects
          const closureArgs = handlerArgs.slice(0, handler.params.length);
          while (closureArgs.length < handler.params.length) {
            closureArgs.push(mkSym('nil'));
          }
          result = await applyClosure(handler, closureArgs, ctx, evalExpr);
        }
      }
    }

    // After rule execution, check invariants
    const invariants = getInvariants(ctx);
    for (const inv of invariants) {
      const invResult = await evalExpr(inv.expr, ctx);
      if (invResult.kind === 'verdict' && (invResult.bits & 1) === 0) {
        // Invariant violated — return false verdict
        return mkVerdict(FALSE, [mkSym('invariant-violated'), result]);
      }
    }

    return result;
  } finally {
    setDispatchDepth(ctx, depth);
  }
}

/**
 * (invariant expr)
 *
 * Declares a conservation invariant. The expression is stored and checked
 * after every emit.
 */
export async function handleInvariant(
  args: ASTNode[],
  ctx: EvalContext,
  _evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('invariant: requires exactly 1 expression');
  getInvariants(ctx).push({ expr: args[0] });
  return mkSym('nil');
}

/**
 * (check-invariants)
 *
 * Manually check all invariants and return a verdict.
 */
export async function handleCheckInvariants(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  const invariants = getInvariants(ctx);
  const violations: AlgValue[] = [];

  for (const inv of invariants) {
    const result = await evalExpr(inv.expr, ctx);
    if (result.kind === 'verdict') {
      if ((result.bits & 1) === 0) {
        violations.push(result);
      }
    } else {
      // Non-verdict result: truthy check
      if (result.kind === 'atom' && (result.value === 0 || result.value === 'false' || result.value === 'nil')) {
        violations.push(mkVerdict(FALSE));
      }
    }
  }

  if (violations.length === 0) {
    return mkVerdict(TRUE);
  }
  return mkVerdict(FALSE, violations);
}

/**
 * (make-segment :name "a" :mass 10 ...)
 *
 * Creates a list-based record from keyword arguments.
 */
export async function handleMakeSegment(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  const items: AlgValue[] = [mkSym('segment')];
  for (let i = 0; i < args.length; i++) {
    const node = args[i];
    if (node.type === 'symbol' && node.name.startsWith(':')) {
      items.push(mkSym(node.name));
      i++;
      if (i < args.length) {
        items.push(await evalExpr(args[i], ctx));
      }
    } else {
      items.push(await evalExpr(node, ctx));
    }
  }
  return mkList(items);
}

/**
 * (get-field record :field)
 *
 * Get a field value from a list-based record.
 */
export async function handleGetField(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 2) throw new Error('get-field: requires record and :field');
  const record = await evalExpr(args[0], ctx);
  const fieldNode = args[1];
  if (fieldNode.type !== 'symbol' || !fieldNode.name.startsWith(':')) {
    throw new Error('get-field: second argument must be a keyword (e.g. :name)');
  }
  const val = getField(record, fieldNode.name.slice(1));
  if (val === undefined) return mkSym('nil');
  return val;
}

/**
 * (sum-field container :field)
 *
 * Sums a numeric field across all segments in a state container.
 */
export async function handleSumField(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 2) throw new Error('sum-field: requires container and :field');
  const containerRef = await evalExpr(args[0], ctx);
  const fieldNode = args[1];
  if (fieldNode.type !== 'symbol' || !fieldNode.name.startsWith(':')) {
    throw new Error('sum-field: second argument must be a keyword');
  }
  const fieldName = fieldNode.name.slice(1);

  const container = resolveState(containerRef);
  if (!container) throw new Error('sum-field: first argument must be a state container');

  let sum = 0;
  for (const seg of container.segments) {
    const val = getField(seg, fieldName);
    if (val && val.kind === 'atom' && typeof val.value === 'number') {
      sum += val.value;
    }
  }
  return mkNum(sum);
}
