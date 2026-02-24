import { describe, it, expect } from 'vitest';
import {
  mkEvidenceDB, affirm, deny, queryClaim, getEntry,
} from '../../src/evaluator/evidence.js';
import {
  mkStr, mkNum, mkSym, mkList, mkVerdict,
  NEITHER, TRUE, FALSE, BOTH,
  isTrue, isFalse, isBoth, isNeither,
} from '../../src/types/index.js';
import { mkContra } from '../../src/types/contra.js';
import { mkContext } from '../../src/evaluator/context.js';
import type { ASTNode } from '../../src/parser/ast.js';
import type { EvalContext } from '../../src/evaluator/context.js';
import type { AlgValue } from '../../src/types/index.js';
import {
  handleClaim, handleAffirm, handleDeny, handleMeaning, handleResolve,
} from '../../src/evaluator/evidence-specials.js';

// ── Helper: minimal evalExpr for special form tests ─────────────────

/** A minimal evalExpr that handles literals and symbols from the context. */
async function evalExpr(ast: ASTNode, ctx: EvalContext): Promise<AlgValue> {
  switch (ast.type) {
    case 'number': return mkNum(ast.value);
    case 'string': return mkStr(ast.value);
    case 'symbol': {
      // Look up in environment, or return as symbol
      let env = ctx.env;
      while (env) {
        const val = env.bindings.get(ast.name);
        if (val !== undefined) return val;
        env = env.parent!;
      }
      return mkSym(ast.name);
    }
    case 'list': {
      // Evaluate list elements
      const items = await Promise.all(ast.elements.map(e => evalExpr(e, ctx)));
      return mkList(items);
    }
  }
}

// ── AST node helpers ────────────────────────────────────────────────

function sym(name: string): ASTNode {
  return { type: 'symbol', name, line: 0, col: 0 };
}

function str(value: string): ASTNode {
  return { type: 'string', value, line: 0, col: 0 };
}

function num(value: number): ASTNode {
  return { type: 'number', value, line: 0, col: 0 };
}

// ═══════════════════════════════════════════════════════════════════
// EvidenceDB unit tests
// ═══════════════════════════════════════════════════════════════════

describe('EvidenceDB', () => {
  it('starts empty', () => {
    const db = mkEvidenceDB();
    expect(db.entries.size).toBe(0);
  });

  it('affirm adds support evidence', () => {
    const db = mkEvidenceDB();
    const db2 = affirm(db, 'P', mkStr('observed'));
    const entry = getEntry(db2, 'P');
    expect(entry).toBeDefined();
    expect(entry!.support).toHaveLength(1);
    expect(entry!.refutation).toHaveLength(0);
  });

  it('deny adds refutation evidence', () => {
    const db = mkEvidenceDB();
    const db2 = deny(db, 'P', mkStr('contradicted'));
    const entry = getEntry(db2, 'P');
    expect(entry).toBeDefined();
    expect(entry!.support).toHaveLength(0);
    expect(entry!.refutation).toHaveLength(1);
  });

  it('affirm never removes refutation', () => {
    let db = mkEvidenceDB();
    db = deny(db, 'P', mkStr('contradicted'));
    db = affirm(db, 'P', mkStr('observed'));
    const entry = getEntry(db, 'P');
    expect(entry!.support).toHaveLength(1);
    expect(entry!.refutation).toHaveLength(1);
  });

  it('deny never removes support', () => {
    let db = mkEvidenceDB();
    db = affirm(db, 'P', mkStr('observed'));
    db = deny(db, 'P', mkStr('contradicted'));
    const entry = getEntry(db, 'P');
    expect(entry!.support).toHaveLength(1);
    expect(entry!.refutation).toHaveLength(1);
  });

  it('is immutable — original DB unchanged', () => {
    const db = mkEvidenceDB();
    affirm(db, 'P', mkStr('x'));
    expect(db.entries.size).toBe(0);
  });

  it('multiple affirms accumulate', () => {
    let db = mkEvidenceDB();
    db = affirm(db, 'P', mkStr('A'));
    db = affirm(db, 'P', mkStr('B'));
    const entry = getEntry(db, 'P');
    expect(entry!.support).toHaveLength(2);
  });
});

describe('queryClaim', () => {
  it('no evidence → NEITHER', () => {
    const db = mkEvidenceDB();
    const v = queryClaim(db, 'Q');
    expect(v.bits).toBe(NEITHER);
    expect(isNeither(v)).toBe(true);
  });

  it('support only → TRUE', () => {
    let db = mkEvidenceDB();
    db = affirm(db, 'P', mkStr('observed'));
    const v = queryClaim(db, 'P');
    expect(v.bits).toBe(TRUE);
    expect(isTrue(v)).toBe(true);
  });

  it('refutation only → FALSE', () => {
    let db = mkEvidenceDB();
    db = deny(db, 'P', mkStr('contradicted'));
    const v = queryClaim(db, 'P');
    expect(v.bits).toBe(FALSE);
    expect(isFalse(v)).toBe(true);
  });

  it('both support and refutation → BOTH', () => {
    let db = mkEvidenceDB();
    db = affirm(db, 'P', mkStr('A'));
    db = deny(db, 'P', mkStr('B'));
    const v = queryClaim(db, 'P');
    expect(v.bits).toBe(BOTH);
    expect(isBoth(v)).toBe(true);
  });

  it('verdict includes all evidence in why', () => {
    let db = mkEvidenceDB();
    db = affirm(db, 'P', mkStr('A'));
    db = affirm(db, 'P', mkStr('B'));
    const v = queryClaim(db, 'P');
    expect(v.why).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Special form handler tests
// ═══════════════════════════════════════════════════════════════════

describe('handleAffirm + handleClaim', () => {
  it('(affirm P :because "observed") then (claim P) → TRUE', async () => {
    const ctx = mkContext();
    // (affirm P :because "observed")
    await handleAffirm([sym('P'), sym(':because'), str('observed')], ctx, evalExpr);
    // (claim P)
    const v = await handleClaim([sym('P')], ctx, evalExpr);
    expect(v.kind).toBe('verdict');
    expect((v as any).bits).toBe(TRUE);
  });
});

describe('handleDeny + handleClaim', () => {
  it('(deny P :because "contradicted") then (claim P) → FALSE', async () => {
    const ctx = mkContext();
    await handleDeny([sym('P'), sym(':because'), str('contradicted')], ctx, evalExpr);
    const v = await handleClaim([sym('P')], ctx, evalExpr);
    expect(v.kind).toBe('verdict');
    expect((v as any).bits).toBe(FALSE);
  });
});

describe('contradiction via affirm + deny', () => {
  it('(affirm P) + (deny P) + (claim P) → BOTH', async () => {
    const ctx = mkContext();
    await handleAffirm([sym('P'), sym(':because'), str('A')], ctx, evalExpr);
    await handleDeny([sym('P'), sym(':because'), str('B')], ctx, evalExpr);
    const v = await handleClaim([sym('P')], ctx, evalExpr);
    expect(v.kind).toBe('verdict');
    expect((v as any).bits).toBe(BOTH);
  });
});

describe('no evidence', () => {
  it('(claim Q) with no evidence → NEITHER', async () => {
    const ctx = mkContext();
    const v = await handleClaim([sym('Q')], ctx, evalExpr);
    expect(v.kind).toBe('verdict');
    expect((v as any).bits).toBe(NEITHER);
  });
});

describe('multiple affirms accumulate', () => {
  it('(affirm P :because "A") + (affirm P :because "B") + (claim P) → TRUE with both', async () => {
    const ctx = mkContext();
    await handleAffirm([sym('P'), sym(':because'), str('A')], ctx, evalExpr);
    await handleAffirm([sym('P'), sym(':because'), str('B')], ctx, evalExpr);
    const v = await handleClaim([sym('P')], ctx, evalExpr);
    expect(v.kind).toBe('verdict');
    expect((v as any).bits).toBe(TRUE);
    expect((v as any).why).toHaveLength(2);
  });
});

describe('handleMeaning', () => {
  it('(meaning <contra>) → tension info', async () => {
    const ctx = mkContext();
    // Create a Contra value for the context
    const contra = mkContra(mkStr('yes'), mkStr('no'), mkStr('whyP'), mkStr('whyN'), 0.7, 'test');
    // We need meaning to eval a Contra — put it in env
    const bindings = new Map<string, AlgValue>();
    bindings.set('c', contra);
    ctx.env = { bindings, parent: null };

    const result = await handleMeaning([sym('c')], ctx, evalExpr);
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      // First element should be the symbol 'tension'
      expect(result.items[0]).toEqual(mkSym('tension'));
      // Second element should be the tension number
      expect(result.items[1]).toEqual(mkNum(0.7));
    }
  });

  it('(meaning 42) → zero-tension', async () => {
    const ctx = mkContext();
    const result = await handleMeaning([num(42)], ctx, evalExpr);
    expect(result).toEqual(mkSym('zero-tension'));
  });

  it('(meaning <verdict BOTH>) → tension info', async () => {
    const ctx = mkContext();
    // First create a BOTH verdict via affirm+deny
    await handleAffirm([sym('P'), sym(':because'), str('A')], ctx, evalExpr);
    await handleDeny([sym('P'), sym(':because'), str('B')], ctx, evalExpr);

    // Put the verdict of claim P into env
    const verdict = await handleClaim([sym('P')], ctx, evalExpr);
    const bindings = new Map<string, AlgValue>();
    bindings.set('v', verdict);
    ctx.env = { bindings, parent: null };

    const result = await handleMeaning([sym('v')], ctx, evalExpr);
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      expect(result.items[0]).toEqual(mkSym('tension'));
    }
  });
});

describe('handleResolve', () => {
  it('resolves a Contra by picking the positive side', async () => {
    const ctx = mkContext();
    const contra = mkContra(mkStr('yes-val'), mkStr('no-val'), mkStr('w1'), mkStr('w2'), 0.5, 'test');
    const bindings = new Map<string, AlgValue>();
    bindings.set('c', contra);
    ctx.env = { bindings, parent: null };

    const result = await handleResolve([sym('c')], ctx, evalExpr);
    expect(result).toEqual(mkStr('yes-val'));
  });

  it('passes through non-Contra values', async () => {
    const ctx = mkContext();
    const result = await handleResolve([num(42)], ctx, evalExpr);
    expect(result).toEqual(mkNum(42));
  });
});
