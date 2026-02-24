/**
 * Multi-reading execution and coherence checking.
 *
 * `polyread` runs a fable under multiple readings, compares results
 * through a kernel function, and returns a coherence certificate
 * or a Contra with quantified tension.
 */

import type { Fable, Reading, AlgValue, Contra } from '../types/values.js';
import { mkNum, mkStr } from '../types/values.js';
import { mkContra } from '../types/contra.js';
import type { MeaningGraph } from './meaning-graph.js';
import { applyReading } from './reading.js';

// ── Result types ─────────────────────────────────────────────────────

export interface PolyreadResult {
  readonly coherent: boolean;
  readonly results: ReadonlyMap<string, AlgValue>;
  readonly residual: number;
  readonly contra?: Contra;
}

// ── Observable extraction ────────────────────────────────────────────

/**
 * Extract observable values from a meaning graph as a simplified
 * steady-state estimate.
 *
 * Full ODE simulation is out of scope. This produces a symbolic/numeric
 * summary: node count, edge count, and observable expressions as strings.
 */
function extractObservables(graph: MeaningGraph): Map<string, AlgValue> {
  const result = new Map<string, AlgValue>();

  // Encode structural properties as numeric values
  result.set('__nodeCount', mkNum(graph.nodes.size));
  result.set('__edgeCount', mkNum(graph.edges.length));

  // Each observable expression becomes a string value
  for (const [name, expr] of graph.observables) {
    result.set(name, mkStr(expr));
  }

  // Encode topology signature: sorted node types joined
  const types = [...graph.nodes.values()].map(n => n.type).sort().join(',');
  result.set('__topology', mkStr(types));

  return result;
}

// ── Default comparison kernel ────────────────────────────────────────

/**
 * Default comparison kernel: compute a residual measuring structural
 * divergence between reading results.
 *
 * Returns 0 when all readings produce identical structure, >0 otherwise.
 * The residual is the count of differing observable values across
 * all reading pairs.
 */
function defaultCompareKernel(results: ReadonlyMap<string, AlgValue>): number {
  const entries = [...results.entries()];
  if (entries.length <= 1) return 0;

  let diffs = 0;
  // Compare each pair of reading results
  // Results are structured as "readingName:obsName" → value
  const readingNames = new Set<string>();
  const obsByReading = new Map<string, Map<string, string>>();

  for (const [key, val] of entries) {
    const sep = key.indexOf(':');
    if (sep === -1) continue;
    const rName = key.slice(0, sep);
    const obsName = key.slice(sep + 1);
    readingNames.add(rName);
    if (!obsByReading.has(rName)) obsByReading.set(rName, new Map());
    obsByReading.get(rName)!.set(obsName, valueToString(val));
  }

  const names = [...readingNames];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const obsA = obsByReading.get(names[i]) ?? new Map();
      const obsB = obsByReading.get(names[j]) ?? new Map();
      const allKeys = new Set([...obsA.keys(), ...obsB.keys()]);
      for (const k of allKeys) {
        if (obsA.get(k) !== obsB.get(k)) diffs++;
      }
    }
  }

  return diffs;
}

function valueToString(v: AlgValue): string {
  if (v.kind === 'atom') return String(v.value);
  return JSON.stringify(v);
}

// ── polyread ─────────────────────────────────────────────────────────

/**
 * Run a fable under multiple readings, compare results, and return
 * a coherence certificate or Contra.
 *
 * @param fable      The fable whose graph to read
 * @param readings   Array of readings to apply
 * @param compareKernel  Function that computes residual from combined results
 * @param tolerance  Maximum residual for coherence
 */
export async function polyread(
  fable: Fable,
  readings: Reading[],
  compareKernel: (results: ReadonlyMap<string, AlgValue>) => number = defaultCompareKernel,
  tolerance: number = 0,
): Promise<PolyreadResult> {
  const graph = fable.graph as MeaningGraph;
  const combinedResults = new Map<string, AlgValue>();
  const perReadingResults = new Map<string, AlgValue>();

  for (const reading of readings) {
    const reread = applyReading(graph, reading);
    const observables = extractObservables(reread);

    // Store per-reading results with prefixed keys for the kernel
    for (const [obsName, obsVal] of observables) {
      combinedResults.set(`${reading.name}:${obsName}`, obsVal);
    }

    // Store a summary value per reading (topology signature)
    const topology = observables.get('__topology');
    if (topology) {
      perReadingResults.set(reading.name, topology);
    }
  }

  const residual = compareKernel(combinedResults);
  const coherent = residual <= tolerance;

  if (coherent) {
    return { coherent: true, results: perReadingResults, residual };
  }

  // Incoherent: build a Contra
  const readingNames = readings.map(r => r.name);
  const contra = mkContra(
    perReadingResults.get(readingNames[0]) ?? mkStr('unknown'),
    perReadingResults.get(readingNames[1]) ?? mkStr('unknown'),
    mkStr(`Reading "${readingNames[0]}" observables`),
    mkStr(`Reading "${readingNames[1]}" observables`),
    residual,
    'polyread',
  );

  return { coherent: false, results: perReadingResults, residual, contra };
}
