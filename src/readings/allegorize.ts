/**
 * `(allegorize R fable)` — return the re-read meaning graph as a value.
 *
 * Unlike `with-reading` which evaluates expressions under a reading,
 * `allegorize` returns the transformed IR itself — the meaning graph
 * after the reading's map has been applied.
 */

import type { Fable, Reading } from '../types/values.js';
import { mkFable } from '../types/values.js';
import type { MeaningGraph } from './meaning-graph.js';
import { applyReading } from './reading.js';

/**
 * Apply a reading to a fable's meaning graph and return a new Fable
 * wrapping the re-read graph.
 *
 * This is the "allegoresis made executable" — one meaning graph,
 * re-embodied through a different reading, returned as a new IR.
 */
export function allegorize(reading: Reading, fable: Fable): Fable {
  const graph = fable.graph as MeaningGraph;
  const rereadGraph = applyReading(graph, reading);
  return mkFable(rereadGraph);
}
