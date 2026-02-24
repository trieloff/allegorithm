import { describe, it, expect } from 'vitest';
import { tokenize, TokenizerError } from '../../src/parser/tokenizer.js';

describe('tokenizer', () => {
  describe('basic tokens', () => {
    it('tokenizes parentheses', () => {
      const tokens = tokenize('()');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: 'lparen', value: '(' });
      expect(tokens[1]).toMatchObject({ type: 'rparen', value: ')' });
    });

    it('tokenizes nested parentheses', () => {
      const tokens = tokenize('(())');
      expect(tokens).toHaveLength(4);
      expect(tokens.map(t => t.type)).toEqual(['lparen', 'lparen', 'rparen', 'rparen']);
    });
  });

  describe('numbers', () => {
    it('tokenizes integers', () => {
      const tokens = tokenize('42');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '42' });
    });

    it('tokenizes negative integers', () => {
      // Note: -42 as standalone is a number; in context like (- 42) it's symbol then number
      const tokens = tokenize('-42');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '-42' });
    });

    it('tokenizes floats', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '3.14' });
    });

    it('tokenizes scientific notation', () => {
      const tokens = tokenize('1e10');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '1e10' });
    });

    it('tokenizes negative scientific notation', () => {
      const tokens = tokenize('1.5e-3');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '1.5e-3' });
    });

    it('tokenizes numbers starting with dot', () => {
      const tokens = tokenize('.5');
      expect(tokens[0]).toMatchObject({ type: 'number', value: '.5' });
    });
  });

  describe('strings', () => {
    it('tokenizes simple strings', () => {
      const tokens = tokenize('"hello"');
      expect(tokens[0]).toMatchObject({ type: 'string', value: 'hello' });
    });

    it('tokenizes strings with escape sequences', () => {
      const tokens = tokenize('"hello\\nworld"');
      expect(tokens[0]).toMatchObject({ type: 'string', value: 'hello\nworld' });
    });

    it('tokenizes strings with escaped quotes', () => {
      const tokens = tokenize('"say \\"hi\\""');
      expect(tokens[0]).toMatchObject({ type: 'string', value: 'say "hi"' });
    });

    it('tokenizes empty strings', () => {
      const tokens = tokenize('""');
      expect(tokens[0]).toMatchObject({ type: 'string', value: '' });
    });

    it('throws on unterminated strings', () => {
      expect(() => tokenize('"hello')).toThrow(TokenizerError);
      expect(() => tokenize('"hello')).toThrow(/Unterminated string/);
    });
  });

  describe('symbols', () => {
    it('tokenizes simple symbols', () => {
      const tokens = tokenize('foo');
      expect(tokens[0]).toMatchObject({ type: 'symbol', value: 'foo' });
    });

    it('tokenizes hyphenated symbols', () => {
      const tokens = tokenize('with-reading');
      expect(tokens[0]).toMatchObject({ type: 'symbol', value: 'with-reading' });
    });

    it('tokenizes symbols with special characters', () => {
      const tokens = tokenize('≈');
      expect(tokens[0]).toMatchObject({ type: 'symbol', value: '≈' });
    });

    it('tokenizes keyword-like symbols', () => {
      const tokens = tokenize(':effort');
      expect(tokens[0]).toMatchObject({ type: 'symbol', value: ':effort' });
    });

    it('tokenizes symbols with question marks', () => {
      const tokens = tokenize('dominates?');
      expect(tokens[0]).toMatchObject({ type: 'symbol', value: 'dominates?' });
    });

    it('tokenizes unit-like symbols separately from numbers', () => {
      const tokens = tokenize('1 kg');
      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ type: 'number', value: '1' });
      expect(tokens[1]).toMatchObject({ type: 'symbol', value: 'kg' });
    });
  });

  describe('quote', () => {
    it('tokenizes quote character', () => {
      const tokens = tokenize("'foo");
      expect(tokens[0]).toMatchObject({ type: 'quote', value: "'" });
      expect(tokens[1]).toMatchObject({ type: 'symbol', value: 'foo' });
    });
  });

  describe('comments', () => {
    it('skips line comments', () => {
      const tokens = tokenize('; this is a comment\n42');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: 'number', value: '42' });
    });

    it('skips inline comments', () => {
      const tokens = tokenize('42 ; a number');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: 'number', value: '42' });
    });

    it('handles comment at end of file without newline', () => {
      const tokens = tokenize('; just a comment');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('line and column tracking', () => {
    it('tracks line numbers across newlines', () => {
      const tokens = tokenize('foo\nbar\nbaz');
      expect(tokens[0]).toMatchObject({ line: 1, col: 1 });
      expect(tokens[1]).toMatchObject({ line: 2, col: 1 });
      expect(tokens[2]).toMatchObject({ line: 3, col: 1 });
    });

    it('tracks column numbers', () => {
      const tokens = tokenize('(foo bar)');
      expect(tokens[0]).toMatchObject({ type: 'lparen', line: 1, col: 1 });
      expect(tokens[1]).toMatchObject({ type: 'symbol', line: 1, col: 2 });
      expect(tokens[2]).toMatchObject({ type: 'symbol', line: 1, col: 6 });
      expect(tokens[3]).toMatchObject({ type: 'rparen', line: 1, col: 9 });
    });
  });

  describe('complex expressions', () => {
    it('tokenizes a full expression', () => {
      const tokens = tokenize('(def x 42)');
      expect(tokens.map(t => t.type)).toEqual(['lparen', 'symbol', 'symbol', 'number', 'rparen']);
      expect(tokens.map(t => t.value)).toEqual(['(', 'def', 'x', '42', ')']);
    });

    it('tokenizes nested expression', () => {
      const tokens = tokenize('(+ (* 2 3) 4)');
      expect(tokens).toHaveLength(9);
    });
  });
});
