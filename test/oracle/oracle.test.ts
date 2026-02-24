import { describe, it, expect } from 'vitest';
import { callOracle, validateSchema, attemptWitnessPayment } from '../../src/oracle/oracle.js';
import { mkMockOracle } from '../../src/oracle/llm-client.js';
import { mkVerdict, TRUE, FALSE, BOTH } from '../../src/types/values.js';
import type { Hypothesis, Verdict, AlgValue } from '../../src/types/values.js';

describe('callOracle', () => {
  it('returns Hypothesis with debt "unwitnessed" for valid response', async () => {
    const client = mkMockOracle(new Map([['classify', 'positive']]));

    const result = await callOracle(client, 'classify', { text: 'good' }, null, 'analyst');

    expect(result.kind).toBe('hypothesis');
    expect(result.debt).toBe('unwitnessed');
    expect(result.value.kind).toBe('atom');
    if (result.value.kind === 'atom') {
      expect(result.value.value).toBe('positive');
    }
  });

  it('schema validation passes → Hypothesis returned', async () => {
    const client = mkMockOracle(new Map([['get-info', { name: 'test', score: 5 }]]));

    const result = await callOracle(
      client, 'get-info', {}, { name: 'string', score: 'number' }, 'system',
    );

    expect(result.kind).toBe('hypothesis');
    expect(result.debt).toBe('unwitnessed');
  });

  it('schema validation fails → Hypothesis with schema-failed debt', async () => {
    const client = mkMockOracle(new Map([['get-info', 'just a string']]));

    const result = await callOracle(
      client, 'get-info', {}, { name: 'string', score: 'number' }, 'system',
    );

    expect(result.kind).toBe('hypothesis');
    expect(result.debt).toBe('schema-failed');
    expect(result.value.kind).toBe('contra');
  });

  it('preserves issuer on Hypothesis evidence', async () => {
    const client = mkMockOracle(new Map([['task', 'result']]));

    const result = await callOracle(client, 'task', null, null, 'my-authority');

    expect(result.kind).toBe('hypothesis');
    const evidence = result.evidence.map(e =>
      e.kind === 'atom' ? String(e.value) : e.kind
    );
    expect(evidence).toContain('issuer:my-authority');
  });

  it('mock oracle with different responses for different tasks', async () => {
    const client = mkMockOracle(new Map([
      ['task-1', 'answer-1'],
      ['task-2', 42],
    ]));

    const r1 = await callOracle(client, 'task-1', null, null, 'a');
    const r2 = await callOracle(client, 'task-2', null, null, 'b');

    expect(r1.value.kind).toBe('atom');
    if (r1.value.kind === 'atom') expect(r1.value.value).toBe('answer-1');

    expect(r2.value.kind).toBe('atom');
    if (r2.value.kind === 'atom') expect(r2.value.value).toBe(42);
  });
});

describe('validateSchema', () => {
  it('returns true for null schema', () => {
    expect(validateSchema('anything', null)).toBe(true);
  });

  it('validates string type', () => {
    expect(validateSchema('hello', 'string')).toBe(true);
    expect(validateSchema(42, 'string')).toBe(false);
  });

  it('validates number type', () => {
    expect(validateSchema(42, 'number')).toBe(true);
    expect(validateSchema('hello', 'number')).toBe(false);
  });

  it('validates object keys exist', () => {
    expect(validateSchema({ name: 'x', age: 5 }, { name: 'string', age: 'number' })).toBe(true);
    expect(validateSchema({ name: 'x' }, { name: 'string', age: 'number' })).toBe(false);
  });

  it('rejects non-object for object schema', () => {
    expect(validateSchema('string', { key: 'value' })).toBe(false);
  });

  it('accepts any type', () => {
    expect(validateSchema(42, 'any')).toBe(true);
    expect(validateSchema('hello', 'any')).toBe(true);
  });
});

describe('attemptWitnessPayment', () => {
  const makeHypothesis = (val: string): Hypothesis => ({
    kind: 'hypothesis',
    value: { kind: 'atom', value: val, isSymbol: false },
    evidence: [{ kind: 'atom', value: 'model:mock', isSymbol: false }],
    debt: 'unwitnessed',
  });

  it('all witnesses pass → value promoted (debt cleared)', () => {
    const hyp = makeHypothesis('good answer');
    const witnesses = [
      (_v: AlgValue): Verdict => mkVerdict(TRUE),
      (_v: AlgValue): Verdict => mkVerdict(TRUE),
    ];

    const result = attemptWitnessPayment(hyp, witnesses);

    expect(result.kind).toBe('atom');
    if (result.kind === 'atom') {
      expect(result.value).toBe('good answer');
    }
  });

  it('one witness fails → Contra with failure details', () => {
    const hyp = makeHypothesis('bad answer');
    const witnesses = [
      (_v: AlgValue): Verdict => mkVerdict(TRUE),
      (_v: AlgValue): Verdict => mkVerdict(FALSE),
    ];

    const result = attemptWitnessPayment(hyp, witnesses);

    expect(result.kind).toBe('contra');
    if (result.kind === 'contra') {
      expect(result.site).toBe('oracle:witness');
    }
  });

  it('BOTH verdict from witness → Contra', () => {
    const hyp = makeHypothesis('ambiguous');
    const witnesses = [
      (_v: AlgValue): Verdict => mkVerdict(BOTH),
    ];

    const result = attemptWitnessPayment(hyp, witnesses);

    expect(result.kind).toBe('contra');
  });

  it('no witnesses → value promoted immediately', () => {
    const hyp = makeHypothesis('no witnesses needed');
    const result = attemptWitnessPayment(hyp, []);

    expect(result.kind).toBe('atom');
    if (result.kind === 'atom') {
      expect(result.value).toBe('no witnesses needed');
    }
  });
});
