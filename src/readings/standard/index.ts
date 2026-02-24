/**
 * Standard readings canon — curated reading families demonstrating
 * the allegorithmic framework on well-known physical dualities.
 */

export {
  createOscillatorFable,
  createMechReading,
  createElecReading,
  witnessDimensionalConsistency,
  witnessTopologyIsomorphism,
} from './mech-elec.js';

export {
  createNetworkFable,
  createCircuitReading,
  createMarkovReading,
  witnessKirchhoffConservation,
  witnessCommuteTimeIdentity,
} from './network-markov.js';
