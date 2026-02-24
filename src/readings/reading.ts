/**
 * Reading record operations — apply a reading map to a meaning graph.
 *
 * A Reading maps domain-neutral bond-graph concepts to domain-specific
 * equivalents (e.g., force→voltage, velocity→current for mech→elec).
 */

import type { Reading, AlgValue, Verdict, Atom } from '../types/values.js';
import { mkVerdict, TRUE, FALSE } from '../types/values.js';
import type { MeaningGraph, MGNode, MGEdge } from './meaning-graph.js';
import { mkMGNode, mkMGEdge, mkMeaningGraph } from './meaning-graph.js';

// ── Reading map helpers ──────────────────────────────────────────────

/** Extract a string value from an AlgValue (atom). */
function valueToString(v: AlgValue): string {
  if (v.kind === 'atom') return String(v.value);
  return JSON.stringify(v);
}

/** Look up a key in the reading's map, returning the mapped string or the original. */
function mapKey(readingMap: ReadonlyMap<string, AlgValue>, key: string): string {
  const mapped = readingMap.get(key);
  return mapped ? valueToString(mapped) : key;
}

// ── applyReading ─────────────────────────────────────────────────────

/**
 * Apply a reading to a meaning graph: rename node types, remap params,
 * and transform edge kinds according to the reading's map.
 *
 * The reading's map keys correspond to bond-graph concepts:
 *   - Node types: "I", "C", "R", "0J", "1J", "source", "sensor"
 *   - Edge kinds: "effort", "flow", "signal"
 *   - Parameter names are remapped if they appear as keys
 */
export function applyReading(graph: MeaningGraph, reading: Reading): MeaningGraph {
  const rmap = reading.map;
  const newNodes = new Map<string, MGNode>();

  for (const [id, node] of graph.nodes) {
    // Remap node type
    const newType = mapKey(rmap, node.type);

    // Remap parameter names (and values if the reading provides numeric mappings)
    const newParams = new Map<string, number>();
    for (const [paramName, paramVal] of node.params) {
      const newParamName = mapKey(rmap, paramName);
      newParams.set(newParamName, paramVal);
    }

    // Remap port names
    const newPorts = node.ports.map(p => mapKey(rmap, p));

    newNodes.set(id, mkMGNode(id, newType, newParams, newPorts));
  }

  // Remap edge kinds
  const newEdges: MGEdge[] = graph.edges.map(edge => {
    const newKind = mapKey(rmap, edge.kind) as MGEdge['kind'];
    return mkMGEdge(edge.from, edge.to, newKind);
  });

  // Remap observable expressions (string substitution for mapped terms)
  const newObservables = new Map<string, string>();
  for (const [name, expr] of graph.observables) {
    let newExpr = expr;
    for (const [key, val] of rmap) {
      newExpr = newExpr.replaceAll(key, valueToString(val));
    }
    newObservables.set(name, newExpr);
  }

  return mkMeaningGraph(graph.name, newNodes, newEdges, newObservables);
}

// ── executeWitnesses ─────────────────────────────────────────────────

/**
 * Execute witnesses against a meaning graph, returning Verdicts.
 *
 * Witnesses are AlgValues that describe checks. For now, witnesses
 * are symbolic checks: each witness is compared structurally against
 * the graph. A witness "passes" (TRUE) if the graph contains a node
 * or observable matching the witness's value.
 *
 * Full witness execution (running closures) requires the evaluator,
 * which is a separate module. This is the simplified structural check.
 */
export function executeWitnesses(graph: MeaningGraph, reading: Reading): Verdict[] {
  return reading.witnesses.map(witness => {
    if (witness.kind === 'atom' && !witness.isSymbol) {
      // String witness: check if this string appears as a node type or observable
      const target = String(witness.value);
      const hasNode = [...graph.nodes.values()].some(n => n.type === target);
      const hasObs = graph.observables.has(target);
      return mkVerdict(hasNode || hasObs ? TRUE : FALSE, [witness]);
    }

    if (witness.kind === 'atom' && witness.isSymbol) {
      // Symbol witness: check if this symbol appears as a node ID or observable name
      const target = String(witness.value);
      const hasNode = graph.nodes.has(target);
      const hasObs = graph.observables.has(target);
      return mkVerdict(hasNode || hasObs ? TRUE : FALSE, [witness]);
    }

    // For closure or list witnesses, we'd need the evaluator.
    // Return NEITHER (no information) for unsupported witness types.
    return mkVerdict(0, [witness]);
  });
}
