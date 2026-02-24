import { describe, it, expect } from 'vitest';
import { printValue } from '../../src/printer/printer.js';
import {
  mkNum, mkStr, mkSym, mkList, mkVerdict, mkHypothesis,
  mkAuthority, mkAttestation, mkClosure, mkFable, mkReading,
  emptyEnv, TRUE, FALSE, BOTH, NEITHER,
} from '../../src/types/index.js';
import { mkContra } from '../../src/types/contra.js';

describe('printValue', () => {
  it('prints numbers', () => {
    expect(printValue(mkNum(42))).toBe('42');
    expect(printValue(mkNum(3.14))).toBe('3.14');
  });

  it('prints strings with quotes', () => {
    expect(printValue(mkStr('hello'))).toBe('"hello"');
  });

  it('prints symbols without quotes', () => {
    expect(printValue(mkSym('foo'))).toBe('foo');
  });

  it('prints lists with parens', () => {
    expect(printValue(mkList([mkNum(1), mkNum(2), mkNum(3)]))).toBe('(1 2 3)');
    expect(printValue(mkList([]))).toBe('()');
  });

  it('prints closures', () => {
    const c = mkClosure(emptyEnv(), ['x', 'y'], mkSym('nil'));
    expect(printValue(c)).toBe('#<closure (x y)>');
  });

  it('prints Verdict TRUE', () => {
    expect(printValue(mkVerdict(TRUE))).toBe('\u2713 true');
  });

  it('prints Verdict FALSE', () => {
    expect(printValue(mkVerdict(FALSE))).toBe('\u2717 false');
  });

  it('prints Verdict BOTH', () => {
    expect(printValue(mkVerdict(BOTH))).toContain('BOTH');
    expect(printValue(mkVerdict(BOTH))).toContain('contradiction');
  });

  it('prints Verdict NEITHER', () => {
    expect(printValue(mkVerdict(NEITHER))).toContain('neither');
    expect(printValue(mkVerdict(NEITHER))).toContain('underdetermined');
  });

  it('prints Contra with tension', () => {
    const c = mkContra(mkStr('yes'), mkStr('no'), mkStr('w1'), mkStr('w2'), 0.7, 'test');
    const output = printValue(c);
    expect(output).toContain('CONTRADICTION');
    expect(output).toContain('tension: 0.7');
    expect(output).toContain('yes:');
    expect(output).toContain('no:');
  });

  it('prints Hypothesis with debt', () => {
    const h = mkHypothesis(mkNum(42), [], 'unwitnessed');
    expect(printValue(h)).toContain('42');
    expect(printValue(h)).toContain('unwitnessed');
  });

  it('prints Authority', () => {
    const a = mkAuthority('alice', 'human', ['security'], 5);
    const output = printValue(a);
    expect(output).toContain('alice');
    expect(output).toContain('human');
    expect(output).toContain('rank 5');
  });

  it('prints Attestation', () => {
    const auth = mkAuthority('bob', 'llm', [], 3);
    const att = mkAttestation(auth, mkStr('claim'), 'ethics');
    const output = printValue(att);
    expect(output).toContain('bob');
    expect(output).toContain('ethics');
  });

  it('prints Fable', () => {
    const f = mkFable({});
    expect(printValue(f)).toContain('fable');
  });

  it('prints Reading', () => {
    const r = mkReading('electrical', mkSym('bond-graph'), new Map(), [], 1.0);
    expect(printValue(r)).toContain('electrical');
  });
});
