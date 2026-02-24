import { describe, it, expect } from 'vitest';
import { parse, ParseError } from '../../src/parser/parser.js';
import { ASTNode } from '../../src/parser/ast.js';

describe('parser', () => {
  describe('atoms', () => {
    it('parses a number', () => {
      const result = parse('42');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'number', value: 42 });
    });

    it('parses a float', () => {
      const result = parse('3.14');
      expect(result[0]).toMatchObject({ type: 'number', value: 3.14 });
    });

    it('parses a string', () => {
      const result = parse('"hello"');
      expect(result[0]).toMatchObject({ type: 'string', value: 'hello' });
    });

    it('parses a symbol', () => {
      const result = parse('foo');
      expect(result[0]).toMatchObject({ type: 'symbol', name: 'foo' });
    });

    it('parses multiple top-level forms', () => {
      const result = parse('1 2 3');
      expect(result).toHaveLength(3);
      expect(result.map(n => (n as any).value)).toEqual([1, 2, 3]);
    });
  });

  describe('lists', () => {
    it('parses empty list', () => {
      const result = parse('()');
      expect(result[0]).toMatchObject({ type: 'list', elements: [] });
    });

    it('parses simple list', () => {
      const result = parse('(+ 1 2)');
      const list = result[0] as any;
      expect(list.type).toBe('list');
      expect(list.elements).toHaveLength(3);
      expect(list.elements[0]).toMatchObject({ type: 'symbol', name: '+' });
      expect(list.elements[1]).toMatchObject({ type: 'number', value: 1 });
      expect(list.elements[2]).toMatchObject({ type: 'number', value: 2 });
    });

    it('parses nested lists', () => {
      const result = parse('(+ (* 2 3) 4)');
      const list = result[0] as any;
      expect(list.elements[1].type).toBe('list');
      expect(list.elements[1].elements[0]).toMatchObject({ type: 'symbol', name: '*' });
    });

    it('parses deeply nested lists', () => {
      const result = parse('(a (b (c (d (e)))))');
      let node = result[0] as any;
      for (const name of ['a', 'b', 'c', 'd', 'e']) {
        expect(node.type).toBe('list');
        expect(node.elements[0]).toMatchObject({ type: 'symbol', name });
        if (name !== 'e') {
          node = node.elements[1];
        }
      }
    });
  });

  describe('quote sugar', () => {
    it("parses 'expr as (quote expr)", () => {
      const result = parse("'foo");
      expect(result[0]).toMatchObject({
        type: 'list',
        elements: [
          { type: 'symbol', name: 'quote' },
          { type: 'symbol', name: 'foo' },
        ],
      });
    });

    it("parses '(1 2 3) as (quote (1 2 3))", () => {
      const result = parse("'(1 2 3)");
      const list = result[0] as any;
      expect(list.type).toBe('list');
      expect(list.elements[0]).toMatchObject({ type: 'symbol', name: 'quote' });
      expect(list.elements[1].type).toBe('list');
      expect(list.elements[1].elements).toHaveLength(3);
    });

    it("parses nested quotes ''x", () => {
      const result = parse("''x");
      const outer = result[0] as any;
      expect(outer.elements[0]).toMatchObject({ type: 'symbol', name: 'quote' });
      const inner = outer.elements[1];
      expect(inner.elements[0]).toMatchObject({ type: 'symbol', name: 'quote' });
      expect(inner.elements[1]).toMatchObject({ type: 'symbol', name: 'x' });
    });
  });

  describe('comments', () => {
    it('ignores comments', () => {
      const result = parse(`
        ; this is a comment
        (def x 42) ; inline comment
      `);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: 'list' });
    });
  });

  describe('error handling', () => {
    it('throws on unmatched opening paren', () => {
      expect(() => parse('(foo bar')).toThrow(ParseError);
      expect(() => parse('(foo bar')).toThrow(/Unmatched opening parenthesis/);
    });

    it('throws on unexpected closing paren', () => {
      expect(() => parse(')')).toThrow(ParseError);
      expect(() => parse(')')).toThrow(/Unexpected closing parenthesis/);
    });

    it('throws on unterminated string', () => {
      expect(() => parse('"hello')).toThrow(/Unterminated string/);
    });

    it('error includes line and column', () => {
      try {
        parse('(\n  "unterminated');
        expect.fail('should have thrown');
      } catch (e: any) {
        expect(e.line).toBeDefined();
        expect(e.col).toBeDefined();
      }
    });
  });

  describe('line and column in AST', () => {
    it('tracks position of atoms', () => {
      const result = parse('foo');
      expect(result[0]).toMatchObject({ line: 1, col: 1 });
    });

    it('tracks position of list elements', () => {
      const result = parse('(foo bar)');
      const list = result[0] as any;
      expect(list.line).toBe(1);
      expect(list.col).toBe(1);
      expect(list.elements[0].col).toBe(2);
      expect(list.elements[1].col).toBe(6);
    });
  });

  describe('design conversation examples', () => {
    it('parses the oscillator example', () => {
      const source = `
(deffable osc
  (ports (drive :effort) (sense :flow))
  (I m 1 kg)
  (C k 4 N/m)
  (R c 0.2 N*s/m)
  (1J j)
  (connect drive j)
  (connect j (I m) (C k) (R c))
  (observe x (integrate sense))
  (observe P (power drive sense)))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const fable = result[0] as any;
      expect(fable.type).toBe('list');
      expect(fable.elements[0]).toMatchObject({ type: 'symbol', name: 'deffable' });
      expect(fable.elements[1]).toMatchObject({ type: 'symbol', name: 'osc' });
      // Check ports sub-expression
      const ports = fable.elements[2];
      expect(ports.type).toBe('list');
      expect(ports.elements[0]).toMatchObject({ type: 'symbol', name: 'ports' });
    });

    it('parses the simulate expression', () => {
      const source = '(simulate osc :t 10 s :dt 1 ms :drive (step 1 N))';
      const result = parse(source);
      expect(result).toHaveLength(1);
      const sim = result[0] as any;
      expect(sim.elements[0]).toMatchObject({ type: 'symbol', name: 'simulate' });
    });

    it('parses the contradiction example', () => {
      const source = `
(contra
  :yes    matryoshka-net
  :no     (overruled matryoshka-net :by SecLead)
  :why+   (attestation Lars)
  :why-   (attestation SecLead)
  :tension {:normative (authority-gap Lars SecLead)
            :objective 0})
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const contra = result[0] as any;
      expect(contra.type).toBe('list');
      expect(contra.elements[0]).toMatchObject({ type: 'symbol', name: 'contra' });
    });

    it('parses the court/authority example', () => {
      const source = `
(defcourt NetCourt
  :scope  "network-stack"
  :order  (dominates? issuerA issuerB)
  :policy (canon-by :max-authority :then :min-tension))

(defauthority Claude
  :kind   :llm
  :cred   {:model "claude-code"}
  :rank   10)

(defauthority Lars
  :kind   :human
  :cred   {:role "principal"}
  :rank   70)
`;
      const result = parse(source);
      expect(result).toHaveLength(3);
      expect((result[0] as any).elements[0]).toMatchObject({ type: 'symbol', name: 'defcourt' });
      expect((result[1] as any).elements[0]).toMatchObject({ type: 'symbol', name: 'defauthority' });
      expect((result[2] as any).elements[0]).toMatchObject({ type: 'symbol', name: 'defauthority' });
    });

    it('parses the with-reading expression', () => {
      const source = `
(with-reading mech->elec
  (simulate osc :t 10 s :dt 1 ms :drive (step 1 V)))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const wr = result[0] as any;
      expect(wr.elements[0]).toMatchObject({ type: 'symbol', name: 'with-reading' });
      expect(wr.elements[1]).toMatchObject({ type: 'symbol', name: 'mech->elec' });
    });

    it('parses the polyread expression', () => {
      const source = `
(polyread [identity mech->elec] osc
  :drive (step 1)
  :assert (≈ (trace :x under identity)
             (trace :charge under mech->elec)))
`;
      // Note: [ and ] are not special in our S-expression syntax — they're symbol chars
      const result = parse(source);
      expect(result).toHaveLength(1);
    });

    it('parses the network layer example', () => {
      const source = `
(deflayer L2
  (wrap   (fn (p) (doll :L2 (hdr :mtu mtu :crc (crc p)) p)))
  (unwrap (fn (d) (require (= (crc (payload d)) (hdr d :crc)))
                 (payload d))))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const layer = result[0] as any;
      expect(layer.elements[0]).toMatchObject({ type: 'symbol', name: 'deflayer' });
      expect(layer.elements[1]).toMatchObject({ type: 'symbol', name: 'L2' });
    });

    it('parses the oracle example', () => {
      const source = `
(let ((R* (oracle :issuer Claude
                  :task "propose a reading for network stack as nested dolls"
                  :schema ReadingRecord)))
  (with-court NetCourt
    (canon
      (polyread [R*] net-fable :tol 1e-6))))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const letExpr = result[0] as any;
      expect(letExpr.elements[0]).toMatchObject({ type: 'symbol', name: 'let' });
    });

    it('parses the Lagrangian example', () => {
      const source = `
(deflagrangian free-particle
  (param m :units kg)
  (field x(t) :units m)
  (L (- (* 1/2 m (square (∂t x))))))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const lag = result[0] as any;
      expect(lag.elements[0]).toMatchObject({ type: 'symbol', name: 'deflagrangian' });
    });

    it('parses the ouroboros example', () => {
      const source = `
(deffable ouro
  (state (cycle segments))
  (rule eat (predator prey)
    (transfer prey.mass -> predator.mass :fraction α)
    (embed prey inside predator)
    (on prey.eat (fn (p q) (emit (eat predator q)))))
  (moral
    (invariant (≥ segment.mass 0))
    (invariant (= (sum mass) const))))
`;
      const result = parse(source);
      expect(result).toHaveLength(1);
      const fable = result[0] as any;
      expect(fable.elements[0]).toMatchObject({ type: 'symbol', name: 'deffable' });
      expect(fable.elements[1]).toMatchObject({ type: 'symbol', name: 'ouro' });
    });
  });

  describe('special forms are just symbols', () => {
    const specialForms = [
      'def', 'fn', 'let', 'do', 'if', 'quote',
      'deffable', 'defreading', 'defcourt', 'defauthority',
      'with-reading', 'with-court', 'polyread',
      'claim', 'affirm', 'deny', 'contra', 'resolve', 'meaning',
      'canon', 'refute', 'attest', 'oracle', 'moral',
      'deflagrangian', 'deflayer', 'defstack', 'defpde', 'defnet',
      'rule', 'state', 'transfer', 'embed', 'on', 'emit',
      'doll', 'wrap', 'unwrap', 'hdr', 'payload', 'require',
      'pi-groups', 'simulate', 'solve', 'sample',
    ];

    for (const form of specialForms) {
      it(`parses (${form} ...) as a list with symbol head`, () => {
        const result = parse(`(${form} x)`);
        const list = result[0] as any;
        expect(list.type).toBe('list');
        expect(list.elements[0]).toMatchObject({ type: 'symbol', name: form });
      });
    }
  });
});
