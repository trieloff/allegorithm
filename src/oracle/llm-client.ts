/**
 * Configurable LLM API client for the oracle system.
 *
 * The real client calls an OpenAI-compatible /chat/completions endpoint.
 * A mock client is provided for testing.
 */

export interface OracleConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface OracleRequest {
  task: string;
  input: any;
  schema?: any;
  issuer?: string;
}

export interface OracleResponse {
  value: any;
  model: string;
  usage?: { prompt: number; completion: number };
}

/**
 * Create a real LLM client that calls an OpenAI-compatible API.
 * Formats task+input as a system+user message pair.
 */
export function mkLLMClient(config: OracleConfig): (req: OracleRequest) => Promise<OracleResponse> {
  return async (req: OracleRequest): Promise<OracleResponse> => {
    const messages = [
      { role: 'system', content: req.task },
      { role: 'user', content: JSON.stringify(req.input) },
    ];

    const body = {
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    };

    const res = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Oracle LLM call failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('Oracle LLM call returned no choices');
    }

    let value: any;
    try {
      value = JSON.parse(choice.message.content);
    } catch {
      value = choice.message.content;
    }

    return {
      value,
      model: data.model ?? config.model,
      usage: data.usage
        ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
        : undefined,
    };
  };
}

/**
 * Create a mock oracle client for testing.
 * Maps task strings to predetermined responses.
 */
export function mkMockOracle(responses: Map<string, any>): (req: OracleRequest) => Promise<OracleResponse> {
  return async (req: OracleRequest): Promise<OracleResponse> => {
    const value = responses.get(req.task);
    if (value === undefined) {
      throw new Error(`Mock oracle has no response for task: ${req.task}`);
    }
    return {
      value,
      model: 'mock',
    };
  };
}
