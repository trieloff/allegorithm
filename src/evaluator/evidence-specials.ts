/**
 * Evidence special form handlers: claim, affirm, deny, meaning, resolve.
 *
 * These are registered as special forms by calling registerSpecial()
 * from the evaluator's specials module.
 */

import type { ASTNode } from '../parser/ast.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from './context.js';
import type { SpecialHandler } from './specials.js';
import { mkVerdict, mkSym, mkStr, mkList, mkNum, TRUE, FALSE, BOTH, NEITHER } from '../types/index.js';
import { isContra } from '../types/contra.js';
import { mkEvidenceDB, affirm, deny, queryClaim, getEntry } from './evidence.js';
import type { EvidenceDB } from './evidence.js';

// ── Evidence DB accessor ────────────────────────────────────────────

/**
 * Get or create the EvidenceDB from the eval context.
 * The DB is stored in ctx.options.__evidenceDB.
 */
function getDB(ctx: EvalContext): EvidenceDB {
  if (!ctx.options.__evidenceDB) {
    ctx.options.__evidenceDB = mkEvidenceDB();
  }
  return ctx.options.__evidenceDB as EvidenceDB;
}

function setDB(ctx: EvalContext, db: EvidenceDB): void {
  ctx.options.__evidenceDB = db;
}

// ── Keyword arg parsing ─────────────────────────────────────────────

/**
 * Parse keyword arguments from an AST arg list.
 * Looks for SymbolNodes starting with ":" and pairs them with the next arg.
 * Returns the positional args and a map of keyword→ASTNode.
 */
function parseKeywordArgs(args: ASTNode[]): {
  positional: ASTNode[];
  keywords: Map<string, ASTNode>;
} {
  const positional: ASTNode[] = [];
  const keywords = new Map<string, ASTNode>();

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.type === 'symbol' && arg.name.startsWith(':') && i + 1 < args.length) {
      keywords.set(arg.name, args[i + 1]);
      i += 2;
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { positional, keywords };
}

// ── Extract claim name from an AST node ─────────────────────────────

function claimName(node: ASTNode): string {
  if (node.type === 'symbol') return node.name;
  if (node.type === 'string') return node.value;
  throw new Error(`claim name must be a symbol or string, got ${node.type}`);
}

// ── Special form handlers ───────────────────────────────────────────

/**
 * (claim P) → Verdict
 * Query the evidence database for claim P.
 */
export const handleClaim: SpecialHandler = async (args, ctx, _evalExpr) => {
  if (args.length !== 1) throw new Error('claim requires exactly 1 argument');
  const name = claimName(args[0]);
  const db = getDB(ctx);
  return queryClaim(db, name);
};

/**
 * (affirm P :because E) → Verdict(TRUE, [evidence])
 * Add supporting evidence for claim P.
 */
export const handleAffirm: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('affirm requires at least 1 argument');
  const { positional, keywords } = parseKeywordArgs(args);
  if (positional.length !== 1) throw new Error('affirm requires exactly 1 positional argument (the claim)');

  const name = claimName(positional[0]);

  let evidence: AlgValue;
  const becauseNode = keywords.get(':because');
  if (becauseNode) {
    evidence = await evalExpr(becauseNode, ctx);
  } else {
    evidence = mkSym('affirmed');
  }

  const db = getDB(ctx);
  const newDB = affirm(db, name, evidence);
  setDB(ctx, newDB);

  return mkVerdict(TRUE, [evidence]);
};

/**
 * (deny P :because E) → Verdict(FALSE, [evidence])
 * Add refuting evidence for claim P.
 */
export const handleDeny: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('deny requires at least 1 argument');
  const { positional, keywords } = parseKeywordArgs(args);
  if (positional.length !== 1) throw new Error('deny requires exactly 1 positional argument (the claim)');

  const name = claimName(positional[0]);

  let evidence: AlgValue;
  const becauseNode = keywords.get(':because');
  if (becauseNode) {
    evidence = await evalExpr(becauseNode, ctx);
  } else {
    evidence = mkSym('denied');
  }

  const db = getDB(ctx);
  const newDB = deny(db, name, evidence);
  setDB(ctx, newDB);

  return mkVerdict(FALSE, [evidence]);
};

/**
 * (meaning X) → tension report or zero-tension certificate
 * If X is a Contra, returns a list describing the tension.
 * If X is ordinary, returns a zero-tension symbol.
 */
export const handleMeaning: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length !== 1) throw new Error('meaning requires exactly 1 argument');
  const val = await evalExpr(args[0], ctx);

  if (isContra(val)) {
    return mkList([
      mkSym('tension'),
      mkNum(val.tension),
      mkList([mkSym('yes'), val.yes]),
      mkList([mkSym('no'), val.no]),
      mkList([mkSym('site'), mkStr(val.site)]),
    ]);
  }

  // Check if it's a Verdict with BOTH bits (contradiction in evidence)
  if (val.kind === 'verdict' && val.bits === BOTH) {
    return mkList([
      mkSym('tension'),
      mkNum(1),
      mkList([mkSym('evidence'), ...val.why]),
    ]);
  }

  return mkSym('zero-tension');
};

/**
 * (resolve X :policy P) → resolved value
 * Basic policy: :min-tension picks the side with less evidence against it.
 */
export const handleResolve: SpecialHandler = async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('resolve requires at least 1 argument');
  const { positional, keywords } = parseKeywordArgs(args);
  if (positional.length !== 1) throw new Error('resolve requires exactly 1 positional argument');

  const val = await evalExpr(positional[0], ctx);

  // Default policy is :min-tension
  const policyNode = keywords.get(':policy');
  const policy = policyNode && policyNode.type === 'symbol' ? policyNode.name : ':min-tension';

  if (!isContra(val)) {
    // Nothing to resolve — return as-is
    return val;
  }

  if (policy === ':min-tension' || policy === 'min-tension') {
    // Pick the side with less tension: prefer yes (positive) by default
    // In a more sophisticated version, we'd compare evidence weights
    return val.yes;
  }

  // Unknown policy — return the positive side as default
  return val.yes;
};
