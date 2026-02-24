/**
 * Network↔Markov standard reading (Doyle & Snell).
 *
 * Graph-based dual between electrical resistive networks and random walks.
 *
 * The same graph structure admits two lawful readings:
 *   - Circuit: resistors, voltages, currents (Kirchhoff's laws)
 *   - Markov chain: transition weights, escape probabilities, expected visits
 *
 * Key identity: commute_time(a,b) = 2 * total_conductance * effective_resistance(a,b)
 */

import { mgBuilder } from '../meaning-graph.js';
import type { MeaningGraph } from '../meaning-graph.js';
import { mkReading, mkSym, mkStr, mkVerdict, TRUE, FALSE } from '../../types/values.js';
import type { Reading, Verdict, AlgValue } from '../../types/values.js';
import { applyReading } from '../reading.js';

// ── Fable ────────────────────────────────────────────────────────────

/**
 * Create a 4-node resistive network fable.
 *
 * Topology:
 *   a --R1-- b
 *   |        |
 *   R4      R2
 *   |        |
 *   d --R3-- c
 *
 * Each edge has a resistance parameter. Nodes are graph vertices
 * modeled as 0-junctions (common-effort/voltage nodes).
 */
export function createNetworkFable(): MeaningGraph {
  return mgBuilder('network')
    .addNode('a', '0J', {}, ['effort', 'flow'])
    .addNode('b', '0J', {}, ['effort', 'flow'])
    .addNode('c', '0J', {}, ['effort', 'flow'])
    .addNode('d', '0J', {}, ['effort', 'flow'])
    .addNode('R1', 'R', { resistance: 1 }, ['effort', 'flow'])
    .addNode('R2', 'R', { resistance: 2 }, ['effort', 'flow'])
    .addNode('R3', 'R', { resistance: 1 }, ['effort', 'flow'])
    .addNode('R4', 'R', { resistance: 2 }, ['effort', 'flow'])
    .addEdge('a:flow', 'R1:effort', 'effort')
    .addEdge('R1:flow', 'b:effort', 'effort')
    .addEdge('b:flow', 'R2:effort', 'effort')
    .addEdge('R2:flow', 'c:effort', 'effort')
    .addEdge('c:flow', 'R3:effort', 'effort')
    .addEdge('R3:flow', 'd:effort', 'effort')
    .addEdge('d:flow', 'R4:effort', 'effort')
    .addEdge('R4:flow', 'a:effort', 'effort')
    .observe('conservation', 'sum(flow_in) = sum(flow_out)')
    .observe('total_conductance', 'sum(1/resistance)')
    .build();
}

// ── Readings ─────────────────────────────────────────────────────────

/**
 * Circuit reading: graph → electrical resistive network.
 */
export function createCircuitReading(): Reading {
  const map = new Map<string, AlgValue>([
    ['R', mkStr('resistor')],
    ['0J', mkStr('node')],
    ['resistance', mkStr('ohms')],
    ['effort', mkStr('voltage')],
    ['flow', mkStr('current')],
  ]);

  return mkReading(
    'circuit',
    mkSym('graph'),
    map,
    [mkStr('resistor'), mkStr('voltage')],
    1.0,
  );
}

/**
 * Markov reading: graph → random walk on weighted graph.
 */
export function createMarkovReading(): Reading {
  const map = new Map<string, AlgValue>([
    ['R', mkStr('edge')],
    ['0J', mkStr('state')],
    ['resistance', mkStr('transition-weight')],
    ['effort', mkStr('escape-probability')],
    ['flow', mkStr('expected-visits')],
  ]);

  return mkReading(
    'markov',
    mkSym('graph'),
    map,
    [mkStr('edge'), mkStr('state')],
    1.0,
  );
}

// ── Witnesses ────────────────────────────────────────────────────────

/**
 * Kirchhoff conservation witness.
 *
 * In the circuit reading: total current in = total current out at each node.
 * In the Markov reading: transition probabilities sum to 1 at each state.
 *
 * We verify structurally: each junction node (0J) has equal in-degree
 * and out-degree for flow edges, ensuring conservation holds by topology.
 */
export function witnessKirchhoffConservation(graph: MeaningGraph): Verdict {
  // Check that each 0J node has balanced flow connections
  const junctionNodes = [...graph.nodes.values()].filter(n => n.type === '0J');

  for (const node of junctionNodes) {
    // Count edges incident on this node
    const incoming = graph.edges.filter(e => e.to.startsWith(node.id + ':'));
    const outgoing = graph.edges.filter(e => e.from.startsWith(node.id + ':'));

    if (incoming.length === 0 && outgoing.length === 0) {
      return mkVerdict(FALSE, [mkStr(`node ${node.id} is disconnected`)]);
    }

    // In a well-formed network, each node should have edges
    // flowing both in and out (conservation requires balance)
    if (incoming.length !== outgoing.length) {
      return mkVerdict(FALSE, [
        mkStr(`node ${node.id}: ${incoming.length} in vs ${outgoing.length} out`),
      ]);
    }
  }

  // Also check that the conservation observable exists
  const hasConservation = graph.observables.has('conservation');
  if (!hasConservation) {
    return mkVerdict(FALSE, [mkStr('no conservation observable')]);
  }

  return mkVerdict(TRUE, [
    mkStr(`all ${junctionNodes.length} junction nodes have balanced flow`),
  ]);
}

/**
 * Commute-time identity witness.
 *
 * The Doyle-Snell identity: commute_time(a,b) = 2 * total_conductance * R_eff(a,b)
 *
 * We verify structurally that the graph contains the necessary components:
 * - Resistance parameters on all R-type edges
 * - A total_conductance observable
 * - At least 2 junction nodes (endpoints for commute time)
 */
export function witnessCommuteTimeIdentity(graph: MeaningGraph): Verdict {
  // Check resistance elements have the resistance parameter
  const resistors = [...graph.nodes.values()].filter(n => n.type === 'R');

  for (const r of resistors) {
    if (!r.params.has('resistance')) {
      return mkVerdict(FALSE, [mkStr(`resistor ${r.id} missing resistance param`)]);
    }
    const val = r.params.get('resistance')!;
    if (val <= 0) {
      return mkVerdict(FALSE, [mkStr(`resistor ${r.id} has non-positive resistance`)]);
    }
  }

  // Check total conductance observable
  if (!graph.observables.has('total_conductance')) {
    return mkVerdict(FALSE, [mkStr('missing total_conductance observable')]);
  }

  // Check at least 2 junction nodes for commute time endpoints
  const junctions = [...graph.nodes.values()].filter(n => n.type === '0J');
  if (junctions.length < 2) {
    return mkVerdict(FALSE, [mkStr(`need ≥2 junction nodes, have ${junctions.length}`)]);
  }

  // Compute total conductance and verify it's positive
  const totalConductance = resistors.reduce((sum, r) => {
    return sum + 1 / r.params.get('resistance')!;
  }, 0);

  return mkVerdict(TRUE, [
    mkStr(`${resistors.length} resistors, ${junctions.length} nodes, total conductance = ${totalConductance}`),
  ]);
}
