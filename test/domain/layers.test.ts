import { describe, it, expect } from 'vitest';
import { run } from '../../src/index.js';
import type { AlgValue } from '../../src/types/index.js';

describe('layer/stack composition', () => {
  // ── deflayer ──────────────────────────────────────────────────────

  describe('deflayer', () => {
    it('creates a layer with wrap/unwrap closures', async () => {
      const result = await run(`
        (deflayer L2
          (wrap (fn (p) (doll :L2 '((:mtu 1500)) p)))
          (unwrap (fn (d) (payload d))))
      `);
      // Result should be a list tagged as a layer
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__layer__', isSymbol: true });
      }
    });

    it('binds the layer name in the environment', async () => {
      const result = await run(`
        (do
          (deflayer MyLayer
            (wrap (fn (p) p))
            (unwrap (fn (d) d)))
          MyLayer)
      `);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__layer__', isSymbol: true });
      }
    });
  });

  // ── defstack ─────────────────────────────────────────────────────

  describe('defstack', () => {
    it('composes layers into a stack', async () => {
      const result = await run(`
        (do
          (deflayer A
            (wrap (fn (p) (doll :A '() p)))
            (unwrap (fn (d) (payload d))))
          (deflayer B
            (wrap (fn (p) (doll :B '() p)))
            (unwrap (fn (d) (payload d))))
          (defstack S (list A B)))
      `);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__stack__', isSymbol: true });
      }
    });

    it('binds the stack name in the environment', async () => {
      const result = await run(`
        (do
          (deflayer A
            (wrap (fn (p) (doll :A '() p)))
            (unwrap (fn (d) (payload d))))
          (defstack S (list A))
          S)
      `);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__stack__', isSymbol: true });
      }
    });
  });

  // ── doll construction ────────────────────────────────────────────

  describe('doll construction', () => {
    it('creates a doll with tag, header, and payload', async () => {
      const result = await run(`(doll :L2 '((:mtu 1500)) "hello")`);
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__doll__', isSymbol: true });
        // tag
        expect(result.items[1]).toEqual({ kind: 'atom', value: ':L2', isSymbol: true });
        // payload
        expect(result.items[3]).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
      }
    });
  });

  // ── hdr ──────────────────────────────────────────────────────────

  describe('hdr', () => {
    it('extracts a header field by keyword', async () => {
      const result = await run(`
        (do
          (def d (doll :L2 '((:mtu 1500) (:crc 42)) "data"))
          (hdr d :mtu))
      `);
      expect(result).toEqual({ kind: 'atom', value: 1500, isSymbol: false });
    });

    it('returns nil for missing header field', async () => {
      const result = await run(`
        (do
          (def d (doll :L2 '((:mtu 1500)) "data"))
          (hdr d :missing))
      `);
      expect(result).toEqual({ kind: 'atom', value: 'nil', isSymbol: true });
    });
  });

  // ── payload ──────────────────────────────────────────────────────

  describe('payload', () => {
    it('extracts the inner content from a doll', async () => {
      const result = await run(`
        (do
          (def d (doll :L2 '((:mtu 1500)) "hello"))
          (payload d))
      `);
      expect(result).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
    });

    it('extracts nested doll as payload', async () => {
      const result = await run(`
        (do
          (def inner (doll :L3 '() "data"))
          (def outer (doll :L2 '() inner))
          (payload outer))
      `);
      // The payload should be the inner doll
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[0]).toEqual({ kind: 'atom', value: '__doll__', isSymbol: true });
        expect(result.items[1]).toEqual({ kind: 'atom', value: ':L3', isSymbol: true });
      }
    });
  });

  // ── wrap ─────────────────────────────────────────────────────────

  describe('wrap', () => {
    it('applies layers bottom-to-top', async () => {
      const result = await run(`
        (do
          (deflayer A
            (wrap (fn (p) (doll :A '() p)))
            (unwrap (fn (d) (payload d))))
          (deflayer B
            (wrap (fn (p) (doll :B '() p)))
            (unwrap (fn (d) (payload d))))
          (defstack S (list A B))
          (wrap S "hello"))
      `);
      // Should be: A wraps first (bottom), then B wraps that
      // Result: B(A("hello"))
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        // Outermost tag is B (last layer applied)
        expect(result.items[1]).toEqual({ kind: 'atom', value: ':B', isSymbol: true });
        // Payload of B is A-doll
        const innerDoll = result.items[3];
        expect(innerDoll.kind).toBe('list');
        if (innerDoll.kind === 'list') {
          expect(innerDoll.items[1]).toEqual({ kind: 'atom', value: ':A', isSymbol: true });
          // Payload of A is "hello"
          expect(innerDoll.items[3]).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
        }
      }
    });
  });

  // ── unwrap ───────────────────────────────────────────────────────

  describe('unwrap', () => {
    it('strips layers top-to-bottom', async () => {
      const result = await run(`
        (do
          (deflayer A
            (wrap (fn (p) (doll :A '() p)))
            (unwrap (fn (d) (payload d))))
          (deflayer B
            (wrap (fn (p) (doll :B '() p)))
            (unwrap (fn (d) (payload d))))
          (defstack S (list A B))
          (def wrapped (wrap S "hello"))
          (unwrap S wrapped))
      `);
      expect(result).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
    });
  });

  // ── left-inverse property ────────────────────────────────────────

  describe('left-inverse', () => {
    it('unwrap(wrap(x)) = x for valid inputs', async () => {
      const result = await run(`
        (do
          (deflayer L2
            (wrap (fn (p) (doll :L2 '((:mtu 1500)) p)))
            (unwrap (fn (d) (payload d))))
          (deflayer L3
            (wrap (fn (p) (doll :L3 '((:src "10.0.0.1")) p)))
            (unwrap (fn (d) (payload d))))
          (defstack S (list L2 L3))
          (= "data" (unwrap S (wrap S "data"))))
      `);
      // Should be a true verdict
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(1); // TRUE
      }
    });
  });

  // ── require guard ────────────────────────────────────────────────

  describe('require', () => {
    it('returns TRUE verdict when condition is truthy', async () => {
      const result = await run(`(require true)`);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(1); // TRUE
      }
    });

    it('returns FALSE verdict when condition is false — does not throw', async () => {
      const result = await run(`(require false)`);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(2); // FALSE
      }
    });

    it('returns FALSE verdict for nil', async () => {
      const result = await run(`(require nil)`);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(2); // FALSE
      }
    });

    it('passes through verdict values', async () => {
      const result = await run(`(require (= 1 1))`);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(1); // TRUE
      }
    });

    it('passes through contra values', async () => {
      const result = await run(`(require (if both-verdict 1 2))`);
      expect(result.kind).toBe('contra');
    });
  });

  // ── Full network stack example ───────────────────────────────────

  describe('network stack example', () => {
    const networkSetup = `
      (deflayer L2
        (wrap (fn (p) (doll :L2 '((:mtu 1500) (:crc 99)) p)))
        (unwrap (fn (d) (payload d))))

      (deflayer L3
        (wrap (fn (p) (doll :L3 '((:src "10.0.0.1") (:dst "10.0.0.2") (:ttl 64)) p)))
        (unwrap (fn (d) (payload d))))

      (deflayer L4
        (wrap (fn (p) (doll :L4 '((:sport 443) (:dport 51732)) p)))
        (unwrap (fn (d) (payload d))))

      (defstack net (list L2 L3 L4))
    `;

    it('wraps a payload through all layers', async () => {
      const result = await run(`
        (do
          ${networkSetup}
          (def packet (wrap net "hello"))
          packet)
      `);
      // Outermost should be L4 (last layer = top of stack)
      expect(result.kind).toBe('list');
      if (result.kind === 'list') {
        expect(result.items[1]).toEqual({ kind: 'atom', value: ':L4', isSymbol: true });
      }
    });

    it('unwraps back to original payload', async () => {
      const result = await run(`
        (do
          ${networkSetup}
          (def packet (wrap net "hello"))
          (unwrap net packet))
      `);
      expect(result).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
    });

    it('preserves left-inverse property', async () => {
      const result = await run(`
        (do
          ${networkSetup}
          (= "hello" (unwrap net (wrap net "hello"))))
      `);
      expect(result.kind).toBe('verdict');
      if (result.kind === 'verdict') {
        expect(result.bits).toBe(1); // TRUE
      }
    });

    it('allows header inspection at each layer', async () => {
      const result = await run(`
        (do
          ${networkSetup}
          (def packet (wrap net "hello"))
          (hdr packet :sport))
      `);
      expect(result).toEqual({ kind: 'atom', value: 443, isSymbol: false });
    });

    it('allows peeling layers to inspect inner headers', async () => {
      const result = await run(`
        (do
          ${networkSetup}
          (def packet (wrap net "hello"))
          (def l3-doll (payload packet))
          (hdr l3-doll :src))
      `);
      expect(result).toEqual({ kind: 'atom', value: '10.0.0.1', isSymbol: false });
    });
  });
});
