import { describe, it, expect, beforeEach } from 'vitest';
import { run } from '../../src/index.js';
import type { AlgValue } from '../../src/types/index.js';
import { resetLagrangianRegistry } from '../../src/domain/lagrangian.js';
import { checkEnergyConservation, checkMomentumConservation } from '../../src/domain/moral.js';
import { mkList, mkNum, mkSym, TRUE, FALSE } from '../../src/types/index.js';

describe('moral extraction — Lagrangians, Noether, conservation laws', () => {
  beforeEach(() => {
    resetLagrangianRegistry();
  });

  // ── 1. deflagrangian ──────────────────────────────────────────────

  describe('deflagrangian', () => {
    it('parses and stores a Lagrangian correctly', async () => {
      const result = await run(`
        (deflagrangian free-particle
          (param m :units kg)
          (field x :units m)
          (L (* 0.5 (* m (square (∂t x))))))
      `);
      expect(result.kind).toBe('atom');
      if (result.kind === 'atom') {
        expect(typeof result.value).toBe('string');
        expect((result.value as string).startsWith('__lagrangian__:')).toBe(true);
      }
    });

    it('binds the Lagrangian name in the environment', async () => {
      const result = await run(`
        (do
          (deflagrangian free-particle
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))
          free-particle)
      `);
      expect(result.kind).toBe('atom');
      if (result.kind === 'atom') {
        expect((result.value as string).startsWith('__lagrangian__:')).toBe(true);
      }
    });

    it('throws on missing L clause', async () => {
      await expect(run(`
        (deflagrangian broken
          (param m :units kg))
      `)).rejects.toThrow('missing (L expr)');
    });
  });

  // ── 2. Symmetry detection: free particle ──────────────────────────

  describe('symmetry detection', () => {
    it('finds time-translation and space-translation for free particle', async () => {
      // The free-particle Lagrangian L = ½mv² has:
      // - No explicit t → time-translation → energy conserved
      // - No x, only ∂t(x) → space-translation → momentum conserved
      const result = await run(`
        (do
          (deflagrangian free-particle
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))
          (moral free-particle))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        // Should have 2 conservation laws
        expect(result.items.length).toBe(2);

        // First claim: energy-conserved
        const claim1 = result.items[0];
        expect(claim1.kind).toBe('list');
        if (claim1.kind === 'list') {
          expect(claim1.items[1]).toEqual({ kind: 'atom', value: ':energy-conserved', isSymbol: true });
        }

        // Second claim: momentum-conserved
        const claim2 = result.items[1];
        expect(claim2.kind).toBe('list');
        if (claim2.kind === 'list') {
          expect(claim2.items[1]).toEqual({ kind: 'atom', value: ':momentum-conserved', isSymbol: true });
        }
      }
    });
  });

  // ── 3. moral on Lagrangian ────────────────────────────────────────

  describe('moral on Lagrangian', () => {
    it('returns list of conservation claims', async () => {
      const result = await run(`
        (do
          (deflagrangian free-particle
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))
          (moral free-particle))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items.length).toBe(2);
        // Each claim is (claim :name checker)
        for (const claim of result.items) {
          expect(claim.kind).toBe('list');
          if (claim.kind === 'list') {
            expect(claim.items[0]).toEqual({ kind: 'atom', value: 'claim', isSymbol: true });
          }
        }
      }
    });
  });

  // ── 4. Conservation claim evaluation ──────────────────────────────

  describe('conservation claim evaluation', () => {
    it('energy check returns TRUE for constant-velocity trace', () => {
      // Build a trace where v is constant (free particle)
      const trace = mkList([
        mkList([mkList([mkSym('t'), mkNum(0)]), mkList([mkSym('x'), mkNum(0)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(1)])]),
        mkList([mkList([mkSym('t'), mkNum(0.1)]), mkList([mkSym('x'), mkNum(0.3)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(1)])]),
        mkList([mkList([mkSym('t'), mkNum(0.2)]), mkList([mkSym('x'), mkNum(0.6)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(1)])]),
      ]);
      const result = checkEnergyConservation(trace);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(TRUE);
      }
    });

    it('momentum check returns TRUE for constant-velocity trace', () => {
      const trace = mkList([
        mkList([mkList([mkSym('t'), mkNum(0)]), mkList([mkSym('x'), mkNum(0)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(2)])]),
        mkList([mkList([mkSym('t'), mkNum(0.1)]), mkList([mkSym('x'), mkNum(0.6)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(2)])]),
      ]);
      const result = checkMomentumConservation(trace);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(TRUE);
      }
    });

    it('energy check returns FALSE for varying-velocity trace', () => {
      const trace = mkList([
        mkList([mkList([mkSym('t'), mkNum(0)]), mkList([mkSym('x'), mkNum(0)]), mkList([mkSym('v'), mkNum(3)]), mkList([mkSym('m'), mkNum(1)])]),
        mkList([mkList([mkSym('t'), mkNum(0.1)]), mkList([mkSym('x'), mkNum(0.3)]), mkList([mkSym('v'), mkNum(5)]), mkList([mkSym('m'), mkNum(1)])]),
      ]);
      const result = checkEnergyConservation(trace);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(FALSE);
      }
    });
  });

  // ── 5. moral on Contra ────────────────────────────────────────────

  describe('moral on Contra', () => {
    it('returns tension report', async () => {
      const result = await run(`
        (do
          (def c (if both-verdict 1 2))
          (moral c))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: 'tension-report', isSymbol: true });
        // Second element: (tension N)
        const tensionPair = result.items[1];
        expect(tensionPair.kind).toBe('list');
        if (tensionPair.kind === 'list') {
          expect(tensionPair.items[0]).toEqual({ kind: 'atom', value: 'tension', isSymbol: true });
          expect(tensionPair.items[1]).toEqual({ kind: 'atom', value: 1, isSymbol: false });
        }
      }
    });
  });

  // ── 6. moral on ordinary value ────────────────────────────────────

  describe('moral on ordinary value', () => {
    it('returns zero-tension for a number', async () => {
      const result = await run(`(moral 42)`);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: 'zero-tension', isSymbol: true });
      }
    });

    it('returns zero-tension for a string', async () => {
      const result = await run(`(moral "hello")`);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: 'zero-tension', isSymbol: true });
      }
    });

    it('returns zero-tension for a list', async () => {
      const result = await run(`(moral (list 1 2 3))`);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: 'zero-tension', isSymbol: true });
      }
    });
  });

  // ── 7. simulate-lagrangian ────────────────────────────────────────

  describe('simulate-lagrangian', () => {
    it('produces a trace for the free particle', async () => {
      const result = await run(`
        (do
          (deflagrangian free-particle
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))
          (simulate-lagrangian free-particle
            :ic (list (list 'x 0) (list 'v 3))
            :t 1 :dt 0.5 :m 1))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        // t=0, t=0.5, t=1.0 → 3 snapshots
        expect(result.items.length).toBe(3);

        // First snapshot at t=0
        const snap0 = result.items[0];
        expect(snap0.kind).toBe('list');
      }
    });

    it('trace has correct structure with t, x, v, m fields', async () => {
      const result = await run(`
        (do
          (deflagrangian fp
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))
          (simulate-lagrangian fp
            :ic (list (list 'x 0) (list 'v 2))
            :t 0.1 :dt 0.1 :m 3))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        // Check first snapshot structure
        const snap0 = result.items[0];
        expect(snap0.kind).toBe('list');
        if (snap0.kind === 'list') {
          // Should have 4 field pairs: t, x, v, m
          expect(snap0.items.length).toBe(4);
        }
      }
    });
  });

  // ── 8. End-to-end ─────────────────────────────────────────────────

  describe('end-to-end: deflagrangian → moral → simulate → check', () => {
    it('all conservation verdicts are TRUE for free particle', async () => {
      const result = await run(`
        (do
          (deflagrangian free-particle
            (param m :units kg)
            (field x :units m)
            (L (* 0.5 (* m (square (∂t x))))))

          (def trace (simulate-lagrangian free-particle
            :ic (list (list 'x 0) (list 'v 3))
            :t 1 :dt 0.1 :m 1))

          (def laws (moral free-particle))

          ; Check each conservation law against the trace
          (def energy-check (check-conservation (first laws) trace))
          (def momentum-check (check-conservation (first (rest laws)) trace))

          (list energy-check momentum-check))
      `);

      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items.length).toBe(2);

        // Energy check: TRUE
        const eCheck = result.items[0];
        expect(eCheck.kind).toBe('verdict');
        if (eCheck.kind === 'verdict') {
          expect(eCheck.bits).toBe(TRUE);
        }

        // Momentum check: TRUE
        const pCheck = result.items[1];
        expect(pCheck.kind).toBe('verdict');
        if (pCheck.kind === 'verdict') {
          expect(pCheck.bits).toBe(TRUE);
        }
      }
    });
  });
});
