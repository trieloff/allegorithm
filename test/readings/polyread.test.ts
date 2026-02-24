import { describe, it, expect } from 'vitest';
import { polyread } from '../../src/readings/polyread.js';
import { mgBuilder } from '../../src/readings/meaning-graph.js';
import { mkFable, mkReading, mkSym, mkStr } from '../../src/types/index.js';
import type { AlgValue } from '../../src/types/index.js';

/** Build a simple oscillator graph for testing. */
function oscGraph() {
  return mgBuilder('osc')
    .addNode('m', 'I', { m: 1 }, ['effort', 'flow'])
    .addNode('k', 'C', { k: 4 }, ['effort', 'flow'])
    .addNode('c', 'R', { c: 0.2 }, ['effort', 'flow'])
    .addNode('j', '1J', {}, ['effort', 'flow'])
    .addEdge('j:effort', 'm:effort', 'effort')
    .addEdge('j:effort', 'k:effort', 'effort')
    .observe('x', 'integrate flow')
    .build();
}

describe('polyread', () => {
  it('two identical readings produce coherent result (residual ≈ 0)', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    // Identity reading: maps everything to itself
    const identity1 = mkReading('identity-a', mkSym('bond-graph'), new Map(), [], 1.0);
    const identity2 = mkReading('identity-b', mkSym('bond-graph'), new Map(), [], 1.0);

    const result = await polyread(fable, [identity1, identity2]);

    expect(result.coherent).toBe(true);
    expect(result.residual).toBe(0);
    expect(result.contra).toBeUndefined();
    expect(result.results.size).toBe(2);
  });

  it('two conflicting readings return Contra with tension', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    // Identity reading: keeps I, C, R as-is
    const identity = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);

    // Electrical reading: remaps I→L, C→C_elec, R→R_elec
    const elecMap = new Map<string, AlgValue>([
      ['I', mkStr('L')],
      ['C', mkStr('C_elec')],
      ['R', mkStr('R_elec')],
    ]);
    const elecReading = mkReading('elec', mkSym('bond-graph'), elecMap, [], 1.0);

    const result = await polyread(fable, [identity, elecReading]);

    expect(result.coherent).toBe(false);
    expect(result.residual).toBeGreaterThan(0);
    expect(result.contra).toBeDefined();
    expect(result.contra!.tension).toBeGreaterThan(0);
    expect(result.contra!.site).toBe('polyread');
  });

  it('single reading is always coherent', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    const reading = mkReading('solo', mkSym('bond-graph'), new Map(), [], 1.0);
    const result = await polyread(fable, [reading]);

    expect(result.coherent).toBe(true);
    expect(result.residual).toBe(0);
  });

  it('respects tolerance parameter', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    const identity = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);
    const elecMap = new Map<string, AlgValue>([
      ['I', mkStr('L')],
      ['C', mkStr('C_elec')],
      ['R', mkStr('R_elec')],
    ]);
    const elecReading = mkReading('elec', mkSym('bond-graph'), elecMap, [], 1.0);

    // With high tolerance, even conflicting readings are "coherent"
    const result = await polyread(fable, [identity, elecReading], undefined, 100);

    expect(result.coherent).toBe(true);
  });

  it('custom compare kernel is used', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    const identity = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);

    // Custom kernel that always returns 42
    const result = await polyread(fable, [identity], () => 42, 0);

    expect(result.residual).toBe(42);
    expect(result.coherent).toBe(false);
  });
});
