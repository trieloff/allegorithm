import { describe, it, expect } from 'vitest';
import { mkMockOracle, mkLLMClient } from '../../src/oracle/llm-client.js';

describe('mkMockOracle', () => {
  it('returns expected response for a known task', async () => {
    const responses = new Map<string, any>([
      ['summarize', 'This is a summary'],
    ]);
    const client = mkMockOracle(responses);

    const result = await client({ task: 'summarize', input: { text: 'hello' } });

    expect(result.value).toBe('This is a summary');
    expect(result.model).toBe('mock');
  });

  it('throws for unknown task', async () => {
    const client = mkMockOracle(new Map());

    await expect(client({ task: 'unknown', input: null }))
      .rejects.toThrow('Mock oracle has no response for task: unknown');
  });

  it('returns different responses for different tasks', async () => {
    const responses = new Map<string, any>([
      ['task-a', { answer: 42 }],
      ['task-b', 'hello world'],
    ]);
    const client = mkMockOracle(responses);

    const a = await client({ task: 'task-a', input: null });
    const b = await client({ task: 'task-b', input: null });

    expect(a.value).toEqual({ answer: 42 });
    expect(b.value).toBe('hello world');
  });
});

describe('mkLLMClient', () => {
  it('creates a client function', () => {
    const client = mkLLMClient({
      endpoint: 'http://localhost:8080',
      apiKey: 'test-key',
      model: 'gpt-4',
      maxTokens: 100,
      temperature: 0.5,
    });

    expect(typeof client).toBe('function');
  });
});
