/**
 * Oracle module — LLM integration with witness debt.
 */

export {
  type OracleConfig,
  type OracleRequest,
  type OracleResponse,
  mkLLMClient,
  mkMockOracle,
} from './llm-client.js';

export {
  callOracle,
  validateSchema,
  attemptWitnessPayment,
} from './oracle.js';
