import { describe, it, expect } from 'vitest';
import {
  mkNum, mkStr, mkSym, mkList, mkClosure, mkFable,
  mkReading, mkVerdict, mkHypothesis, mkAuthority, mkAttestation,
  emptyEnv, extendEnv,
  TRUE, FALSE, BOTH, NEITHER,
} from '../../src/types/index.js';

describe('Atom constructors', () => {
  it('mkNum creates a numeric atom', () => {
    const a = mkNum(42);
    expect(a.kind).toBe('atom');
    expect(a.value).toBe(42);
    expect(a.isSymbol).toBe(false);
  });

  it('mkStr creates a string atom', () => {
    const a = mkStr('hello');
    expect(a.kind).toBe('atom');
    expect(a.value).toBe('hello');
    expect(a.isSymbol).toBe(false);
  });

  it('mkSym creates a symbolic atom', () => {
    const a = mkSym('x');
    expect(a.kind).toBe('atom');
    expect(a.value).toBe('x');
    expect(a.isSymbol).toBe(true);
  });
});

describe('AlgList', () => {
  it('mkList creates a list of values', () => {
    const l = mkList([mkNum(1), mkStr('two'), mkSym('three')]);
    expect(l.kind).toBe('list');
    expect(l.items).toHaveLength(3);
  });

  it('mkList supports empty lists', () => {
    const l = mkList([]);
    expect(l.items).toHaveLength(0);
  });
});

describe('Closure', () => {
  it('captures env, params, and body', () => {
    const env = emptyEnv();
    const c = mkClosure(env, ['x', 'y'], mkSym('x'));
    expect(c.kind).toBe('closure');
    expect(c.params).toEqual(['x', 'y']);
    expect(c.body).toEqual(mkSym('x'));
    expect(c.env).toBe(env);
  });
});

describe('Fable', () => {
  it('wraps an opaque graph', () => {
    const f = mkFable({ nodes: [], edges: [] });
    expect(f.kind).toBe('fable');
    expect(f.graph).toEqual({ nodes: [], edges: [] });
  });
});

describe('Reading', () => {
  it('holds name, spine, map, witnesses, and metric', () => {
    const spine = mkList([mkSym('a'), mkSym('b')]);
    const map = new Map([['a', mkNum(1)], ['b', mkNum(2)]]);
    const r = mkReading('electrical', spine, map, [mkStr('witness1')], 0.95);

    expect(r.kind).toBe('reading');
    expect(r.name).toBe('electrical');
    expect(r.spine).toBe(spine);
    expect(r.map.get('a')).toEqual(mkNum(1));
    expect(r.witnesses).toHaveLength(1);
    expect(r.metric).toBe(0.95);
  });
});

describe('Verdict', () => {
  it('mkVerdict creates with default empty evidence', () => {
    const v = mkVerdict(TRUE);
    expect(v.kind).toBe('verdict');
    expect(v.bits).toBe(TRUE);
    expect(v.why).toEqual([]);
  });

  it('mkVerdict accepts evidence', () => {
    const v = mkVerdict(BOTH, [mkStr('reason')]);
    expect(v.why).toHaveLength(1);
  });
});

describe('Hypothesis', () => {
  it('holds value, evidence, and debt', () => {
    const h = mkHypothesis(mkNum(42), [mkStr('oracle says')], 'prove > 0');
    expect(h.kind).toBe('hypothesis');
    expect(h.value).toEqual(mkNum(42));
    expect(h.evidence).toHaveLength(1);
    expect(h.debt).toBe('prove > 0');
  });
});

describe('Environment', () => {
  it('emptyEnv has no bindings and no parent', () => {
    const env = emptyEnv();
    expect(env.bindings.size).toBe(0);
    expect(env.parent).toBeNull();
  });

  it('extendEnv chains environments', () => {
    const parent = emptyEnv();
    const bindings = new Map([['x', mkNum(10)]]);
    const child = extendEnv(parent, bindings);

    expect(child.parent).toBe(parent);
    expect(child.bindings.get('x')).toEqual(mkNum(10));
  });
});
