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

describe('basic evaluation', () => {
  it('evaluates a number literal', async () => {
    const result = await run('42');
    expect(result).toEqual({ kind: 'atom', value: 42, isSymbol: false });
  });

  it('evaluates a string literal', async () => {
    const result = await run('"hello"');
    expect(result).toEqual({ kind: 'atom', value: 'hello', isSymbol: false });
  });

  it('evaluates addition', async () => {
    const result = await run('(+ 1 2)');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });

  it('evaluates nested arithmetic', async () => {
    const result = await run('(* (+ 1 2) 3)');
    expect(result).toEqual({ kind: 'atom', value: 9, isSymbol: false });
  });

  it('evaluates subtraction', async () => {
    const result = await run('(- 10 3)');
    expect(result).toEqual({ kind: 'atom', value: 7, isSymbol: false });
  });

  it('evaluates division', async () => {
    const result = await run('(/ 10 2)');
    expect(result).toEqual({ kind: 'atom', value: 5, isSymbol: false });
  });

  it('evaluates modulo', async () => {
    const result = await run('(mod 10 3)');
    expect(result).toEqual({ kind: 'atom', value: 1, isSymbol: false });
  });
});

describe('def and variable reference', () => {
  it('binds and references a variable', async () => {
    const result = await run('(do (def x 42) x)');
    expect(result).toEqual({ kind: 'atom', value: 42, isSymbol: false });
  });

  it('throws on unbound symbol', async () => {
    await expect(run('undefined_var')).rejects.toThrow('Unbound symbol');
  });
});

describe('let bindings', () => {
  it('evaluates let with sequential bindings', async () => {
    const result = await run('(let ((x 1) (y 2)) (+ x y))');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });

  it('let bindings are sequential — later bindings can reference earlier ones', async () => {
    const result = await run('(let ((x 1) (y (+ x 1))) (+ x y))');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });
});

describe('fn and closures', () => {
  it('defines and calls a function', async () => {
    const result = await run('(do (def add (fn (a b) (+ a b))) (add 3 4))');
    expect(result).toEqual({ kind: 'atom', value: 7, isSymbol: false });
  });

  it('closures capture their lexical environment', async () => {
    const result = await run(
      '(do (def make-adder (fn (n) (fn (x) (+ n x)))) (def add5 (make-adder 5)) (add5 3))',
    );
    expect(result).toEqual({ kind: 'atom', value: 8, isSymbol: false });
  });
});

describe('do block', () => {
  it('returns the last expression', async () => {
    const result = await run('(do 1 2 3)');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });

  it('returns nil for empty do', async () => {
    const result = await run('(do)');
    expect(result).toEqual({ kind: 'atom', value: 'nil', isSymbol: true });
  });
});

describe('quote', () => {
  it('returns a quoted list as a value', async () => {
    const result = await run('(quote (1 2 3))');
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      expect(result.items.length).toBe(3);
      expect(result.items[0]).toEqual({ kind: 'atom', value: 1, isSymbol: false });
    }
  });

  it('quote sugar works', async () => {
    const result = await run("'(a b c)");
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      expect(result.items.length).toBe(3);
      expect(result.items[0]).toEqual({ kind: 'atom', value: 'a', isSymbol: true });
    }
  });
});

describe('list operations', () => {
  it('first returns the first element', async () => {
    const result = await run('(first (list 1 2 3))');
    expect(result).toEqual({ kind: 'atom', value: 1, isSymbol: false });
  });

  it('rest returns all but the first', async () => {
    const result = await run('(rest (list 1 2 3))');
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      expect(result.items.length).toBe(2);
      expect(result.items[0]).toEqual({ kind: 'atom', value: 2, isSymbol: false });
      expect(result.items[1]).toEqual({ kind: 'atom', value: 3, isSymbol: false });
    }
  });

  it('cons prepends to a list', async () => {
    const result = await run('(cons 0 (list 1 2))');
    expect(result.kind).toBe('list');
    if (result.kind === 'list') {
      expect(result.items.length).toBe(3);
      expect(result.items[0]).toEqual({ kind: 'atom', value: 0, isSymbol: false });
    }
  });

  it('length returns list length', async () => {
    const result = await run('(length (list 1 2 3))');
    expect(result).toEqual({ kind: 'atom', value: 3, isSymbol: false });
  });

  it('empty? returns true for empty list', async () => {
    const result = await run("(empty? (list))");
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });
});

describe('comparison', () => {
  it('= returns true for equal numbers', async () => {
    const result = await run('(= 1 1)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });

  it('< works', async () => {
    const result = await run('(< 1 2)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1); // TRUE
  });
});

describe('type predicates', () => {
  it('number? is true for numbers', async () => {
    const result = await run('(number? 42)');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1);
  });

  it('string? is true for strings', async () => {
    const result = await run('(string? "hello")');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1);
  });

  it('list? is true for lists', async () => {
    const result = await run('(list? (list 1 2))');
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') expect(result.bits).toBe(1);
  });
});
