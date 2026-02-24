/**
 * Mech↔Elec standard reading via bond graphs.
 *
 * The canonical demonstration of allegorithmic reading:
 * a spring-mass-damper oscillator and its electrical dual (RLC circuit).
 *
 * Bond-graph primitives:
 *   I (inertia)   → mass (mech)   / inductor (elec)
 *   C (compliance) → spring (mech) / capacitor (elec)
 *   R (resistance) → damper (mech) / resistor (elec)
 *   1J             → common-flow junction
 *
 * Generalized variables:
 *   effort → Force (mech) / Voltage (elec)
 *   flow   → Velocity (mech) / Current (elec)
 */

import { mgBuilder } from '../meaning-graph.js';
import type { MeaningGraph } from '../meaning-graph.js';
import { mkReading, mkSym, mkStr, mkVerdict, TRUE, FALSE } from '../../types/values.js';
import type { Reading, Verdict, AlgValue } from '../../types/values.js';
import { applyReading } from '../reading.js';

// ── Fable ────────────────────────────────────────────────────────────

/**
 * Create the oscillator fable: a spring-mass-damper system
 * represented as a bond graph with a 1-junction connecting
 * I (inertia), C (compliance), and R (resistance) elements.
 */
export function createOscillatorFable(): MeaningGraph {
  return mgBuilder('oscillator')
    .addNode('mass', 'I', { m: 1 }, ['effort', 'flow'])
    .addNode('spring', 'C', { k: 4 }, ['effort', 'flow'])
    .addNode('damper', 'R', { c: 0.2 }, ['effort', 'flow'])
    .addNode('junction', '1J', {}, ['effort', 'flow'])
    .addEdge('junction:effort', 'mass:effort', 'effort')
    .addEdge('junction:effort', 'spring:effort', 'effort')
    .addEdge('junction:effort', 'damper:effort', 'effort')
    .addEdge('junction:flow', 'mass:flow', 'flow')
    .addEdge('junction:flow', 'spring:flow', 'flow')
    .addEdge('junction:flow', 'damper:flow', 'flow')
    .observe('power', 'effort * flow')
    .observe('energy_stored', 'integrate effort * flow')
    .build();
}

// ── Readings ─────────────────────────────────────────────────────────

/**
 * Mechanical reading: bond-graph primitives → mechanical domain.
 */
export function createMechReading(): Reading {
  const map = new Map<string, AlgValue>([
    ['I', mkStr('mass')],
    ['C', mkStr('spring')],
    ['R', mkStr('damper')],
    ['effort', mkStr('Force')],
    ['flow', mkStr('Velocity')],
  ]);

  return mkReading(
    'mechanical',
    mkSym('bond-graph'),
    map,
    [mkStr('Force'), mkStr('Velocity')],
    1.0,
  );
}

/**
 * Electrical reading: bond-graph primitives → electrical domain.
 */
export function createElecReading(): Reading {
  const map = new Map<string, AlgValue>([
    ['I', mkStr('inductor')],
    ['C', mkStr('capacitor')],
    ['R', mkStr('resistor')],
    ['effort', mkStr('Voltage')],
    ['flow', mkStr('Current')],
  ]);

  return mkReading(
    'electrical',
    mkSym('bond-graph'),
    map,
    [mkStr('Voltage'), mkStr('Current')],
    1.0,
  );
}

// ── Witnesses ────────────────────────────────────────────────────────

/**
 * Dimensional consistency witness: effort × flow = power in both domains.
 *
 * Checks that the fable's observables contain a power expression
 * that references both effort and flow variables (possibly remapped).
 */
export function witnessDimensionalConsistency(
  graph: MeaningGraph,
  reading: Reading,
): Verdict {
  const reread = applyReading(graph, reading);

  // Check that the power observable exists and references
  // both the effort and flow terms (after remapping)
  const powerObs = reread.observables.get('power');
  if (!powerObs) {
    return mkVerdict(FALSE, [mkStr('no power observable found')]);
  }

  // The effort and flow terms should appear in the power expression
  const effortTerm = reading.map.get('effort');
  const flowTerm = reading.map.get('flow');

  const effortStr = effortTerm ? String((effortTerm as { value: string }).value) : 'effort';
  const flowStr = flowTerm ? String((flowTerm as { value: string }).value) : 'flow';

  const hasEffort = powerObs.includes(effortStr);
  const hasFlow = powerObs.includes(flowStr);

  if (hasEffort && hasFlow) {
    return mkVerdict(TRUE, [
      mkStr(`power = ${powerObs} contains ${effortStr} and ${flowStr}`),
    ]);
  }

  return mkVerdict(FALSE, [
    mkStr(`power = ${powerObs} missing ${!hasEffort ? effortStr : flowStr}`),
  ]);
}

/**
 * Topology isomorphism witness: same node count, edge count,
 * and connectivity after reading application.
 */
export function witnessTopologyIsomorphism(
  graph: MeaningGraph,
  readingA: Reading,
  readingB: Reading,
): Verdict {
  const graphA = applyReading(graph, readingA);
  const graphB = applyReading(graph, readingB);

  const sameNodeCount = graphA.nodes.size === graphB.nodes.size;
  const sameEdgeCount = graphA.edges.length === graphB.edges.length;

  // Connectivity: same edge endpoints (node IDs don't change under reading)
  const edgesA = graphA.edges.map(e => `${e.from}->${e.to}`).sort().join(';');
  const edgesB = graphB.edges.map(e => `${e.from}->${e.to}`).sort().join(';');
  const sameConnectivity = edgesA === edgesB;

  if (sameNodeCount && sameEdgeCount && sameConnectivity) {
    return mkVerdict(TRUE, [
      mkStr(`isomorphic: ${graphA.nodes.size} nodes, ${graphA.edges.length} edges, same connectivity`),
    ]);
  }

  const reasons: AlgValue[] = [];
  if (!sameNodeCount) reasons.push(mkStr(`node count: ${graphA.nodes.size} vs ${graphB.nodes.size}`));
  if (!sameEdgeCount) reasons.push(mkStr(`edge count: ${graphA.edges.length} vs ${graphB.edges.length}`));
  if (!sameConnectivity) reasons.push(mkStr('connectivity differs'));

  return mkVerdict(FALSE, reasons);
}
