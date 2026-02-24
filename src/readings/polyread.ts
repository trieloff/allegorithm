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
 * summary: node count, edge count, connectivity, and role distribution.
 *
 * Structural invariants (prefixed with __) are the same across coherent
 * readings — only surface names differ, which is the whole point of allegory.
 */
function extractObservables(graph: MeaningGraph, originalGraph?: MeaningGraph): Map<string, AlgValue> {
  const result = new Map<string, AlgValue>();

  // Structural invariants (same across coherent readings)
  result.set('__nodeCount', mkNum(graph.nodes.size));
  result.set('__edgeCount', mkNum(graph.edges.length));

  // Connectivity signature: encode which node IDs connect to which
  // Node IDs are stable across readings (applyReading doesn't change IDs)
  const connectivitySig = graph.edges
    .map(e => `${e.from}->${e.to}`)
    .sort()
    .join(';');
  result.set('__connectivity', mkStr(connectivitySig));

  // Role distribution from the ORIGINAL graph (if available)
  // The original graph has the domain-neutral bond-graph roles (I, C, R, etc.)
  // which are invariant across readings. The remapped graph has surface names.
  if (originalGraph) {
    const roleCounts = new Map<string, number>();
    for (const node of originalGraph.nodes.values()) {
      roleCounts.set(node.type, (roleCounts.get(node.type) ?? 0) + 1);
    }
    const rolesSig = [...roleCounts.entries()].sort().map(([t, c]) => `${t}:${c}`).join(',');
    result.set('__roles', mkStr(rolesSig));
  }

  // Observable expressions (these WILL differ across readings — that's fine)
  // They are NOT compared for structural coherence
  for (const [name, expr] of graph.observables) {
    result.set(name, mkStr(expr));
  }

  return result;
}

// ── Default comparison kernel ────────────────────────────────────────

/**
 * Default comparison kernel: compute a residual measuring structural
 * divergence between reading results.
 *
 * Returns 0 when all readings produce identical structure, >0 otherwise.
 * Only compares STRUCTURAL keys (__nodeCount, __edgeCount, __connectivity,
 * __roles) — surface names are supposed to differ across readings.
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
  // Only compare STRUCTURAL keys — not surface names
  const structuralKeys = ['__nodeCount', '__edgeCount', '__connectivity', '__roles'];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const obsA = obsByReading.get(names[i]) ?? new Map();
      const obsB = obsByReading.get(names[j]) ?? new Map();
      for (const k of structuralKeys) {
        const a = obsA.get(k);
        const b = obsB.get(k);
        if (a !== undefined && b !== undefined && a !== b) diffs++;
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
    const observables = extractObservables(reread, graph);

    // Store per-reading results with prefixed keys for the kernel
    for (const [obsName, obsVal] of observables) {
      combinedResults.set(`${reading.name}:${obsName}`, obsVal);
    }

    // Store a summary value per reading (structural signature)
    const connectivity = observables.get('__connectivity');
    const roles = observables.get('__roles');
    const summary = roles ?? connectivity ?? mkStr('unknown');
    perReadingResults.set(reading.name, summary);
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
