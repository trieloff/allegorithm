/**
 * Oracle built-in: wraps LLM output as Hypothesis with witness debt.
 *
 * The oracle ALWAYS returns a Hypothesis with debt="unwitnessed".
 * Witness payment promotes the value or produces a Contra on failure.
 */

import type { AlgValue, Hypothesis, Verdict } from '../types/values.js';
import { mkHypothesis, mkStr } from '../types/values.js';
import { mkContra } from '../types/contra.js';
import { isTrue, isBoth, isFalse } from '../types/verdict.js';
import type { OracleRequest, OracleResponse } from './llm-client.js';

/**
 * Call the oracle, validate response against schema, wrap as Hypothesis.
 *
 * @param client  The LLM client function
 * @param task    What we're asking the oracle
 * @param input   Structured input
 * @param schema  Expected response shape (null to skip validation)
 * @param issuer  Which authority is making this request
 * @returns Hypothesis with debt="unwitnessed", or Contra on schema failure
 */
export async function callOracle(
  client: (req: OracleRequest) => Promise<OracleResponse>,
  task: string,
  input: any,
  schema: any | null,
  issuer: string,
): Promise<Hypothesis> {
  const response = await client({ task, input, schema, issuer });

  // If schema is provided, validate the response
  if (schema !== null && !validateSchema(response.value, schema)) {
    // Schema mismatch — return as Contra wrapped in a Hypothesis
    // The debt is "schema-failed" to indicate validation failure
    const expected = mkStr(JSON.stringify(schema));
    const actual = mkStr(JSON.stringify(response.value));
    const contra = mkContra(
      actual,
      expected,
      mkStr(`Oracle response from ${issuer}`),
      mkStr('Schema validation failed'),
      0.8,
      'oracle:schema',
    );
    // Return a hypothesis whose value IS the contra, so callers see the failure
    return mkHypothesis(contra, [mkStr(`model:${response.model}`)], 'schema-failed');
  }

  // Wrap the raw value as an AlgValue atom
  const value = valueToAlg(response.value);
  const evidence = [mkStr(`model:${response.model}`)];
  if (issuer) {
    evidence.push(mkStr(`issuer:${issuer}`));
  }

  return mkHypothesis(value, evidence, 'unwitnessed');
}

/**
 * Basic schema validation: check that required keys exist.
 * Does not do deep type checking — just shape matching.
 */
export function validateSchema(value: any, schema: any): boolean {
  if (schema === null || schema === undefined) return true;

  // If schema is a string, check that value type matches
  if (typeof schema === 'string') {
    if (schema === 'string') return typeof value === 'string';
    if (schema === 'number') return typeof value === 'number';
    if (schema === 'boolean') return typeof value === 'boolean';
    if (schema === 'object') return typeof value === 'object' && value !== null;
    if (schema === 'array') return Array.isArray(value);
    if (schema === 'any') return true;
    return typeof value === schema;
  }

  // If schema is an object with required keys, check they exist
  if (typeof schema === 'object' && !Array.isArray(schema)) {
    if (typeof value !== 'object' || value === null) return false;
    for (const key of Object.keys(schema)) {
      if (!(key in value)) return false;
    }
    return true;
  }

  return true;
}

/**
 * Attempt to pay witness debt by running witness functions.
 *
 * If all witnesses return TRUE → return hyp.value (debt paid, value promoted).
 * If any witness returns FALSE or BOTH → return Contra with failure details.
 */
export function attemptWitnessPayment(
  hyp: Hypothesis,
  witnesses: ((value: AlgValue) => Verdict)[],
): AlgValue {
  for (let i = 0; i < witnesses.length; i++) {
    const verdict = witnesses[i](hyp.value);
    if (!isTrue(verdict) || isBoth(verdict)) {
      // Witness failed — return Contra
      return mkContra(
        hyp.value,
        mkStr(`witness[${i}] rejected`),
        mkStr(`hypothesis from: ${hyp.evidence.map(e => e.kind === 'atom' ? String(e.value) : e.kind).join(', ')}`),
        mkStr(`verdict: ${verdict.bits}`),
        1.0,
        'oracle:witness',
      );
    }
  }

  // All witnesses passed — debt is paid, return the promoted value
  return hyp.value;
}

/** Convert a raw JS value into an AlgValue. */
function valueToAlg(val: any): AlgValue {
  if (typeof val === 'number') return { kind: 'atom', value: val, isSymbol: false };
  if (typeof val === 'string') return { kind: 'atom', value: val, isSymbol: false };
  if (typeof val === 'boolean') return { kind: 'atom', value: val ? 'true' : 'false', isSymbol: true };
  // For objects/arrays, stringify as a string atom
  return { kind: 'atom', value: JSON.stringify(val), isSymbol: false };
}
