/**
 * Public API for the readings/allegoresis system.
 */

export {
  type MGNode,
  type MGEdge,
  type MeaningGraph,
  type MGBuilder,
  mkMGNode,
  mkMGEdge,
  mkMeaningGraph,
  mgBuilder,
} from './meaning-graph.js';

export {
  applyReading,
  executeWitnesses,
} from './reading.js';

export {
  compileFable,
} from './fable.js';

export {
  type PolyreadResult,
  polyread,
} from './polyread.js';

export {
  allegorize,
} from './allegorize.js';
