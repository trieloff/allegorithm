import { describe, it, expect } from 'vitest';

// Import from the integration layer — this triggers all registrations
import { run, mkDefaultContext } from '../../src/index.js';
import type { AlgValue } from '../../src/types/index.js';
import { BOTH, TRUE, FALSE } from '../../src/types/index.js';

describe('Integration: run() convenience function', () => {
  it('evaluates simple arithmetic', async () => {
    const result = await run('(+ 1 2)');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });

  it('evaluates multiple forms, returns last', async () => {
    const result = await run('(def x 10) (+ x 5)');
    expect(result).toEqual({ kind: 'atom', value: 15, isSymbol: false });
  });

  it('supports prelude bindings (true, false)', async () => {
    const result = await run('true');
    expect(result.kind).toBe('verdict');
    expect((result as any).bits).toBe(TRUE);
  });
});

describe('Integration: evidence specials wired up', () => {
  it('affirm + claim returns TRUE', async () => {
    const ctx = mkDefaultContext();
    const result = await run('(affirm safe :because "tests pass") (claim safe)', ctx);
    expect(result.kind).toBe('verdict');
    expect((result as any).bits).toBe(TRUE);
  });

  it('deny + claim returns FALSE', async () => {
    const ctx = mkDefaultContext();
    const result = await run('(deny safe :because "audit failed") (claim safe)', ctx);
    expect(result.kind).toBe('verdict');
    expect((result as any).bits).toBe(FALSE);
  });

  it('affirm + deny + claim returns BOTH', async () => {
    const ctx = mkDefaultContext();
    const result = await run(
      '(affirm safe :because "tests") (deny safe :because "audit") (claim safe)',
      ctx,
    );
    expect(result.kind).toBe('verdict');
    expect((result as any).bits).toBe(BOTH);
  });

  it('if on BOTH verdict produces Contra', async () => {
    const ctx = mkDefaultContext();
    const result = await run(`
      (affirm safe :because "tests")
      (deny safe :because "audit")
      (def v (claim safe))
      (if v "yes" "no")
    `, ctx);
    expect(result.kind).toBe('contra');
  });
});

describe('Integration: readings specials wired up', () => {
  it('deffable creates a fable', async () => {
    const ctx = mkDefaultContext();
    const result = await run(`
      (deffable my-system
        (I resistor :R 100)
        (C capacitor :C 0.001)
        (connect resistor:out capacitor:in))
    `, ctx);
    expect(result.kind).toBe('fable');
  });
});

describe('Integration: shared context across run calls', () => {
  it('maintains env across calls with shared context', async () => {
    const ctx = mkDefaultContext();
    await run('(def x 42)', ctx);
    const result = await run('x', ctx);
    expect(result).toEqual({ kind: 'atom', value: 42, isSymbol: false });
  });
});
