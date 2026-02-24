/**
 * Court-related special form handlers.
 *
 * Registers handlers for: defauthority, defcourt, attest, refute, with-court, canon.
 * Uses the evaluator's registerSpecial mechanism from specials.ts.
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue, Authority, Attestation } from '../types/values.js';
import type { EvalContext } from './context.js';
import type { FullCourt, Stance } from '../court/index.js';
import { registerSpecial, type EvalFn } from './specials.js';
import { mkAuthority, mkAttestation, mkStr, mkSym, mkList } from '../types/values.js';
import { mkFullCourt, adjudicate, canon } from '../court/index.js';
import { mkRefutation, refutationToContra } from '../court/attestation.js';
import { envSet, envLookup } from './env.js';

import type { CourtPolicy } from '../court/index.js';

// ── Stance storage (keyed by court name → claim → stances) ──────────

const courtStances = new Map<string, Stance[]>();

/** Get stances for a court. */
function getStances(courtName: string): Stance[] {
  let stances = courtStances.get(courtName);
  if (!stances) {
    stances = [];
    courtStances.set(courtName, stances);
  }
  return stances;
}

/** Clear all stances (useful for testing). */
export function clearStances(): void {
  courtStances.clear();
}

// ── Keyword argument helpers ─────────────────────────────────────────

/** Extract keyword arguments from AST args: :key value :key2 value2 */
function extractKeywords(args: ASTNode[]): Map<string, ASTNode> {
  const kw = new Map<string, ASTNode>();
  for (let i = 0; i < args.length - 1; i++) {
    const node = args[i];
    if (node.type === 'symbol' && node.name.startsWith(':')) {
      kw.set(node.name, args[i + 1]);
      i++; // skip value
    }
  }
  return kw;
}

/** Get a keyword string value from AST. */
function kwString(kw: Map<string, ASTNode>, key: string): string | undefined {
  const node = kw.get(key);
  if (!node) return undefined;
  if (node.type === 'string') return node.value;
  if (node.type === 'symbol') return node.name;
  return undefined;
}

/** Get a keyword number value from AST. */
function kwNumber(kw: Map<string, ASTNode>, key: string): number | undefined {
  const node = kw.get(key);
  if (!node) return undefined;
  if (node.type === 'number') return node.value;
  return undefined;
}

/** Get a keyword list of strings from AST. */
function kwStringList(kw: Map<string, ASTNode>, key: string): string[] | undefined {
  const node = kw.get(key);
  if (!node) return undefined;
  if (node.type === 'list') {
    return node.elements
      .map(e => e.type === 'symbol' ? e.name : e.type === 'string' ? e.value : '')
      .filter(s => s !== '');
  }
  return undefined;
}

// ── Special form handlers ────────────────────────────────────────────

/**
 * (defauthority name :kind K :cred (c1 c2...) :rank R)
 * Create an Authority and bind it in the environment.
 */
registerSpecial('defauthority', async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('defauthority requires a name');
  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('defauthority: name must be a symbol');
  const name = nameNode.name;

  const kw = extractKeywords(args.slice(1));
  const kind = kwString(kw, ':kind') ?? 'human';
  const cred = kwStringList(kw, ':cred') ?? [];
  const rank = kwNumber(kw, ':rank') ?? 0;

  const validKinds = ['human', 'llm', 'system', 'institution'];
  if (!validKinds.includes(kind)) {
    throw new Error(`defauthority: invalid kind "${kind}", must be one of: ${validKinds.join(', ')}`);
  }

  const auth = mkAuthority(name, kind as any, cred, rank);
  ctx.env = envSet(ctx.env, name, auth);
  return auth;
});

/**
 * (defcourt name :scope S :order ((cred weight)...) :policy P :threshold T)
 * Create a FullCourt and bind it in the environment.
 */
registerSpecial('defcourt', async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('defcourt requires a name');
  const nameNode = args[0];
  if (nameNode.type !== 'symbol') throw new Error('defcourt: name must be a symbol');
  const name = nameNode.name;

  const kw = extractKeywords(args.slice(1));
  const scope = kwString(kw, ':scope') ?? name;
  const policy = (kwString(kw, ':policy') ?? 'max-authority') as CourtPolicy;
  const threshold = kwNumber(kw, ':threshold') ?? 0.7;

  // Parse dominance rules from :order ((cred weight) ...)
  const dominanceRules = new Map<string, number>();
  const orderNode = kw.get(':order');
  if (orderNode && orderNode.type === 'list') {
    for (const item of orderNode.elements) {
      if (item.type === 'list' && item.elements.length === 2) {
        const credName = item.elements[0].type === 'symbol'
          ? item.elements[0].name
          : item.elements[0].type === 'string'
            ? item.elements[0].value
            : '';
        const weight = item.elements[1].type === 'number'
          ? item.elements[1].value
          : 1.0;
        if (credName) dominanceRules.set(credName, weight);
      }
    }
  }

  const court = mkFullCourt(name, scope, dominanceRules, policy, threshold);
  ctx.env = envSet(ctx.env, name, court as any); // FullCourt stored as env binding
  return mkStr(name); // Return court name as confirmation
});

/**
 * (attest court-name authority-name claim)
 * Create an Attestation and add stance to court.
 */
registerSpecial('attest', async (args, ctx, evalExpr) => {
  if (args.length < 3) throw new Error('attest requires court, authority, and claim');

  const courtNameNode = args[0];
  if (courtNameNode.type !== 'symbol') throw new Error('attest: court must be a symbol');
  const courtName = courtNameNode.name;

  const authNameNode = args[1];
  if (authNameNode.type !== 'symbol') throw new Error('attest: authority must be a symbol');
  const authName = authNameNode.name;

  const authority = envLookup(ctx.env, authName);
  if (!authority || authority.kind !== 'authority') {
    throw new Error(`attest: "${authName}" is not a defined authority`);
  }

  const claim = await evalExpr(args[2], ctx);
  const attestation = mkAttestation(authority, claim, courtName);

  // Add stance to court's stance list
  const stances = getStances(courtName);
  stances.push({
    value: claim,
    issuer: authority,
    evidence: [],
    attestation,
  });

  return attestation;
});

/**
 * (refute court-name authority-name target :because reason)
 * Create a Refutation → normative Contra.
 */
registerSpecial('refute', async (args, ctx, evalExpr) => {
  if (args.length < 3) throw new Error('refute requires court, authority, and target');

  const courtNameNode = args[0];
  if (courtNameNode.type !== 'symbol') throw new Error('refute: court must be a symbol');
  const courtName = courtNameNode.name;

  const authNameNode = args[1];
  if (authNameNode.type !== 'symbol') throw new Error('refute: authority must be a symbol');
  const authName = authNameNode.name;

  const authority = envLookup(ctx.env, authName);
  if (!authority || authority.kind !== 'authority') {
    throw new Error(`refute: "${authName}" is not a defined authority`);
  }

  const targetNode = args[2];
  const target = targetNode.type === 'symbol' ? targetNode.name
    : targetNode.type === 'string' ? targetNode.value
    : '';

  // Extract :because keyword
  const kw = extractKeywords(args.slice(3));
  const reasonNode = kw.get(':because');
  const reason = reasonNode ? await evalExpr(reasonNode, ctx) : mkStr('no reason given');

  const refutation = mkRefutation(courtName, authority, target, reason);

  // Find the original claim in stances to create the Contra
  const stances = getStances(courtName);
  const originalStance = stances.find(s => {
    if (s.value.kind === 'atom' && s.value.isSymbol && s.value.value === target) return true;
    if (s.attestation && s.value.kind === 'atom') return true;
    return false;
  });

  if (originalStance) {
    const contra = refutationToContra(refutation, originalStance.value, originalStance.issuer);
    // Add refutation as a counter-stance
    stances.push({
      value: reason,
      issuer: authority,
      evidence: [reason],
    });
    return contra;
  }

  // No original found — still add the refutation stance
  stances.push({
    value: reason,
    issuer: authority,
    evidence: [reason],
  });
  return mkStr(`refutation:${target}`);
});

/**
 * (with-court court-name expr...)
 * Set active court in context, evaluate body expressions.
 */
registerSpecial('with-court', async (args, ctx, evalExpr) => {
  if (args.length < 2) throw new Error('with-court requires court name and at least one expression');

  const courtNameNode = args[0];
  if (courtNameNode.type !== 'symbol') throw new Error('with-court: court must be a symbol');
  const courtName = courtNameNode.name;

  // Look up the FullCourt from env
  const courtVal = envLookup(ctx.env, courtName);
  // Set as active court in context (use the base Court interface)
  const newCtx: EvalContext = {
    ...ctx,
    court: courtVal as any, // FullCourt extends Court
    options: { ...ctx.options, activeCourt: courtName },
  };

  // Evaluate body expressions
  let result: AlgValue = mkSym('nil');
  for (let i = 1; i < args.length; i++) {
    result = await evalExpr(args[i], newCtx);
  }
  return result;
});

/**
 * (canon claim)
 * Adjudicate a claim through the active court's policy.
 */
registerSpecial('canon', async (args, ctx, evalExpr) => {
  if (args.length < 1) throw new Error('canon requires a claim');

  const claimNode = args[0];
  const claimName = claimNode.type === 'symbol' ? claimNode.name
    : claimNode.type === 'string' ? claimNode.value
    : 'unknown';

  // Get active court from context
  const courtName = ctx.options?.activeCourt;
  if (!courtName) throw new Error('canon: no active court (use with-court)');

  const courtVal = envLookup(ctx.env, courtName);
  if (!courtVal) throw new Error(`canon: court "${courtName}" not found`);

  const court = courtVal as unknown as FullCourt;
  const stances = getStances(courtName);

  const result = canon(court, claimName, stances);

  // Return the binding value (which may be a Contra)
  return result.binding;
});
