import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { run } from '../../src/index.js';
import type { AlgValue } from '../../src/types/index.js';

describe('polysemous values', () => {
  // ── alledge ──────────────────────────────────────────────────

  it('alledge creates a polysemous value with correct readings', async () => {
    const result = await run('(alledge x :as a 1 :as b 2 :as c 3)');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(3);
      expect(result.readings[0]).toEqual({ name: 'a', value: { kind: 'atom', value: 1, isSymbol: false } });
      expect(result.readings[1]).toEqual({ name: 'b', value: { kind: 'atom', value: 2, isSymbol: false } });
      expect(result.readings[2]).toEqual({ name: 'c', value: { kind: 'atom', value: 3, isSymbol: false } });
    }
  });

  it('alledge binds the polysemous value in the environment', async () => {
    const result = await run('(do (alledge x :as a 1 :as b 2) (polysemous? x))');
    expect(result).toEqual({ kind: 'verdict', bits: 1, why: [] }); // TRUE
  });

  it('alledge with string values', async () => {
    const result = await run('(alledge greeting :as formal "Good day" :as casual "Hey")');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings[0].value).toEqual({ kind: 'atom', value: 'Good day', isSymbol: false });
      expect(result.readings[1].value).toEqual({ kind: 'atom', value: 'Hey', isSymbol: false });
    }
  });

  // ── read-all ─────────────────────────────────────────────────

  it('read-all returns polysemous identity', async () => {
    const result = await run('(do (alledge x :as a 1 :as b 2) (read-all x))');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(2);
    }
  });

  it('read-all wraps non-polysemous in single reading', async () => {
    const result = await run('(read-all 42)');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(1);
      expect(result.readings[0].name).toBe('literal');
      expect(result.readings[0].value).toEqual({ kind: 'atom', value: 42, isSymbol: false });
    }
  });

  // ── read-as ──────────────────────────────────────────────────

  it('read-as extracts named reading', async () => {
    const result = await run('(do (alledge x :as small 1 :as large 100) (read-as large x))');
    expect(result).toEqual({ kind: 'atom', value: 100, isSymbol: false });
  });

  it('read-as on non-polysemous returns as-is', async () => {
    const result = await run('(read-as anything 42)');
    expect(result).toEqual({ kind: 'atom', value: 42, isSymbol: false });
  });

  it('read-as with wrong name throws', async () => {
    await expect(run('(do (alledge x :as a 1) (read-as nonexistent x))')).rejects.toThrow('no reading named "nonexistent"');
  });
});

describe('utter variants (side-effect discipline)', () => {
  let output: string[];
  let origWrite: typeof process.stdout.write;

  beforeEach(() => {
    output = [];
    origWrite = process.stdout.write;
    process.stdout.write = ((chunk: any) => { output.push(String(chunk)); return true; }) as any;
  });

  afterEach(() => {
    process.stdout.write = origWrite;
  });

  it('utter! fans across all readings', async () => {
    await run('(do (alledge x :as a "alpha" :as b "beta") (utter! "Value: " (read-all x)))');
    expect(output).toEqual(['Value: alpha\n', 'Value: beta\n']);
  });

  it('utter! with non-polysemous args prints once', async () => {
    await run('(utter! "hello" " world")');
    expect(output).toEqual(['hello world\n']);
  });

  it('utter? does nothing for polysemous args', async () => {
    await run('(do (alledge x :as a 1 :as b 2) (utter? "Value: " (read-all x)))');
    expect(output).toEqual([]);
  });

  it('utter? prints for non-polysemous args', async () => {
    await run('(utter? "certain: " 42)');
    expect(output).toEqual(['certain: 42\n']);
  });

  it('utter... picks first reading', async () => {
    await run('(do (alledge x :as first "alpha" :as second "beta") (utter... "Picked: " (read-all x)))');
    expect(output).toEqual(['Picked: alpha\n']);
  });

  it('utter... with non-polysemous prints normally', async () => {
    await run('(utter... "hello")');
    expect(output).toEqual(['hello\n']);
  });

  it('bare utter throws error', async () => {
    await expect(run('(utter "hello")')).rejects.toThrow('side-effectful function called without polysemy suffix');
  });
});

describe('pure function polysemy propagation', () => {
  it('(+ (read-all x) 1) where x is polysemous → polysemous result', async () => {
    const result = await run('(do (alledge x :as small 1 :as medium 5 :as large 10) (+ (read-all x) 1))');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(3);
      expect(result.readings[0]).toEqual({ name: 'small', value: { kind: 'atom', value: 2, isSymbol: false } });
      expect(result.readings[1]).toEqual({ name: 'medium', value: { kind: 'atom', value: 6, isSymbol: false } });
      expect(result.readings[2]).toEqual({ name: 'large', value: { kind: 'atom', value: 11, isSymbol: false } });
    }
  });

  it('cartesian product: 2×2 → 4 readings', async () => {
    const result = await run(`
      (do
        (alledge x :as a 1 :as b 2)
        (alledge y :as p 10 :as q 20)
        (+ (read-all x) (read-all y)))
    `);
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(4);
      expect(result.readings[0]).toEqual({ name: 'a×p', value: { kind: 'atom', value: 11, isSymbol: false } });
      expect(result.readings[1]).toEqual({ name: 'a×q', value: { kind: 'atom', value: 21, isSymbol: false } });
      expect(result.readings[2]).toEqual({ name: 'b×p', value: { kind: 'atom', value: 12, isSymbol: false } });
      expect(result.readings[3]).toEqual({ name: 'b×q', value: { kind: 'atom', value: 22, isSymbol: false } });
    }
  });

  it('non-polysemous + polysemous: (+ 1 (read-all x)) → polysemous', async () => {
    const result = await run('(do (alledge x :as lo 10 :as hi 100) (+ 1 (read-all x)))');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0].value).toEqual({ kind: 'atom', value: 11, isSymbol: false });
      expect(result.readings[1].value).toEqual({ kind: 'atom', value: 101, isSymbol: false });
    }
  });

  it('list with polysemous arg → polysemous result', async () => {
    const result = await run('(do (alledge x :as a 1 :as b 2) (list (read-all x) 99))');
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(2);
      // Each reading contains a list
      expect(result.readings[0].value.kind).toBe('list');
      expect(result.readings[1].value.kind).toBe('list');
    }
  });

  it('closure propagates polysemy for pure calls', async () => {
    const result = await run(`
      (do
        (def double (fn (n) (* n 2)))
        (alledge x :as a 3 :as b 7)
        (double (read-all x)))
    `);
    expect(result.kind).toBe('polysemous');
    if (result.kind === 'polysemous') {
      expect(result.readings).toHaveLength(2);
      expect(result.readings[0]).toEqual({ name: 'a', value: { kind: 'atom', value: 6, isSymbol: false } });
      expect(result.readings[1]).toEqual({ name: 'b', value: { kind: 'atom', value: 14, isSymbol: false } });
    }
  });
});

describe('polysemous? type predicate', () => {
  it('returns true for polysemous values', async () => {
    const result = await run('(do (alledge x :as a 1 :as b 2) (polysemous? x))');
    expect(result).toEqual({ kind: 'verdict', bits: 1, why: [] }); // TRUE
  });

  it('returns false for non-polysemous values', async () => {
    const result = await run('(polysemous? 42)');
    expect(result).toEqual({ kind: 'verdict', bits: 2, why: [] }); // FALSE
  });
});

describe('printer', () => {
  it('printValue formats polysemous values', async () => {
    const { printValue } = await import('../../src/printer/printer.js');
    const { mkPolysemous, mkNum, mkStr } = await import('../../src/types/values.js');
    const poly = mkPolysemous([
      { name: 'a', value: mkNum(1) },
      { name: 'b', value: mkStr('hello') },
    ]);
    const printed = printValue(poly);
    expect(printed).toBe('a: 1\nb: "hello"');
  });
});
