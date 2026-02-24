import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/index.js';
import { evalExpr, mkContext, preludeBindings } from '../../src/evaluator/index.js';
import { extendEnv, emptyEnv } from '../../src/types/index.js';
import type { AlgValue } from '../../src/types/index.js';

/** Parse and evaluate a source string, returning the last expression's value. */
async function run(source: string): Promise<AlgValue> {
  const ast = parse(source);
  const env = extendEnv(emptyEnv(), preludeBindings());
  const ctx = mkContext({ env });
  let result: AlgValue = { kind: 'atom', value: 'nil', isSymbol: true };
  for (const node of ast) {
    result = await evalExpr(node, ctx);
  }
  return result;
}

describe('classical if', () => {
  it('if with true takes the then branch', async () => {
    const result = await run('(if true 1 2)');
    expect(result).toEqual({ kind: 'atom', value: 1, isSymbol: false });
  });

  it('if with false takes the else branch', async () => {
    const result = await run('(if false 1 2)');
    expect(result).toEqual({ kind: 'atom', value: 2, isSymbol: false });
  });

  it('if with truthy number takes the then branch', async () => {
    const result = await run('(if 42 "yes" "no")');
    expect(result).toEqual({ kind: 'atom', value: 'yes', isSymbol: false });
  });

  it('if with 0 takes the else branch', async () => {
    const result = await run('(if 0 "yes" "no")');
    expect(result).toEqual({ kind: 'atom', value: 'no', isSymbol: false });
  });

  it('if without else returns nil on false', async () => {
    const result = await run('(if false 1)');
    expect(result).toEqual({ kind: 'atom', value: 'nil', isSymbol: true });
  });
});

describe('contradiction-producing if', () => {
  it('if with Both verdict evaluates both branches and returns Contra', async () => {
    const result = await run('(if both-verdict 1 2)');
    expect(result.kind).toBe('contra');
    if (result.kind === 'contra') {
      expect(result.yes).toEqual({ kind: 'atom', value: 1, isSymbol: false });
      expect(result.no).toEqual({ kind: 'atom', value: 2, isSymbol: false });
      expect(result.site).toBe('if');
    }
  });

  it('if with Neither verdict returns Hypothesis with underdetermined debt', async () => {
    const result = await run('(if neither-verdict 1 2)');
    expect(result.kind).toBe('hypothesis');
    if (result.kind === 'hypothesis') {
      expect(result.debt).toBe('underdetermined');
    }
  });

  it('if with Contra condition treats it as Both', async () => {
    // Create a Contra by feeding both-verdict into an if, then use the result as a condition
    const result = await run('(do (def c (if both-verdict 1 2)) (if c "yes" "no"))');
    expect(result.kind).toBe('contra');
    if (result.kind === 'contra') {
      expect(result.yes).toEqual({ kind: 'atom', value: 'yes', isSymbol: false });
      expect(result.no).toEqual({ kind: 'atom', value: 'no', isSymbol: false });
    }
  });

  it('verdict constructor with bits=3 gives Both', async () => {
    const result = await run('(if (verdict 3) "yes" "no")');
    expect(result.kind).toBe('contra');
    if (result.kind === 'contra') {
      expect(result.yes).toEqual({ kind: 'atom', value: 'yes', isSymbol: false });
      expect(result.no).toEqual({ kind: 'atom', value: 'no', isSymbol: false });
    }
  });

  it('verdict constructor with bits=0 gives Neither', async () => {
    const result = await run('(if (verdict 0) "yes" "no")');
    expect(result.kind).toBe('hypothesis');
  });
});

describe('nested contradiction', () => {
  it('inner if produces Contra, outer if sees Contra as Both', async () => {
    // Inner: (if both-verdict 1 2) → Contra(1, 2)
    // Outer: condition is Contra → treated as Both → eval both branches
    const result = await run('(if (if both-verdict 1 2) "yes" "no")');
    expect(result.kind).toBe('contra');
    if (result.kind === 'contra') {
      expect(result.yes).toEqual({ kind: 'atom', value: 'yes', isSymbol: false });
      expect(result.no).toEqual({ kind: 'atom', value: 'no', isSymbol: false });
    }
  });
});

describe('belnap operations from prelude', () => {
  it('v-not flips true to false', async () => {
    const result = await run('(v-not true)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(2); // FALSE
  });

  it('v-and of true and false gives false (T-bit: 1&0=0, F-bit: 0|1=1)', async () => {
    const result = await run('(v-and true false)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(2); // FALSE
  });

  it('v-or of true and false gives true (T-bit: 1|0=1, F-bit: 0&1=0)', async () => {
    const result = await run('(v-or true false)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });

  it('v-and of both and both gives both', async () => {
    const result = await run('(v-and both-verdict both-verdict)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(3); // BOTH
  });

  it('v-or of both and both gives both', async () => {
    const result = await run('(v-or both-verdict both-verdict)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(3); // BOTH
  });

  it('both? detects Both verdict', async () => {
    const result = await run('(both? both-verdict)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });

  it('neither? detects Neither verdict', async () => {
    const result = await run('(neither? neither-verdict)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });
});

describe('contra accessors', () => {
  it('contra-yes extracts the positive derivation', async () => {
    const result = await run('(do (def c (if both-verdict 42 99)) (contra-yes c))');
    expect(result).toEqual({ kind: 'atom', value: 42, isSymbol: false });
  });

  it('contra-no extracts the negative derivation', async () => {
    const result = await run('(do (def c (if both-verdict 42 99)) (contra-no c))');
    expect(result).toEqual({ kind: 'atom', value: 99, isSymbol: false });
  });

  it('contra-site returns "if"', async () => {
    const result = await run('(do (def c (if both-verdict 42 99)) (contra-site c))');
    expect(result).toEqual({ kind: 'atom', value: 'if', isSymbol: false });
  });
});
