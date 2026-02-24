/**
 * Public API for the court adjudication system.
 */

export {
  type CourtPolicy,
  type Stance,
  type AdjudicationResult,
  type FullCourt,
  mkFullCourt,
  adjudicate,
  canon,
  multiCourtAdjudicate,
} from './court.js';

export {
  type Refutation,
  mkRefutation,
  refutationToContra,
} from './attestation.js';
