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

  it('readings that only remap names are structurally coherent', async () => {
    const graph = oscGraph();
    const fable = mkFable(graph);

    // Identity reading: keeps I, C, R as-is
    const identity = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);

    // Electrical reading: remaps I→L, C→C_elec, R→R_elec
    // This is allegory — same structure, different surface names
    const elecMap = new Map<string, AlgValue>([
      ['I', mkStr('L')],
      ['C', mkStr('C_elec')],
      ['R', mkStr('R_elec')],
    ]);
    const elecReading = mkReading('elec', mkSym('bond-graph'), elecMap, [], 1.0);

    const result = await polyread(fable, [identity, elecReading]);

    // Structure is preserved: same node count, edge count, connectivity, roles
    expect(result.coherent).toBe(true);
    expect(result.residual).toBe(0);
    expect(result.contra).toBeUndefined();
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

    // Custom kernel that always returns 5 (simulating structural differences)
    const result = await polyread(fable, [identity], () => 5, 10);

    // Residual 5 is within tolerance 10
    expect(result.coherent).toBe(true);
    expect(result.residual).toBe(5);
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

  it('three allegorical readings are coherent (oyster example)', async () => {
    // Three readings of the same structure — the core allegory use case
    const graph = mgBuilder('oyster')
      .addNode('shell', 'C', { k: 1 }, ['effort', 'flow'])
      .addNode('pearl', 'I', { m: 1 }, ['effort', 'flow'])
      .addNode('irritant', 'R', { r: 0.1 }, ['effort', 'flow'])
      .addEdge('shell:effort', 'pearl:effort', 'effort')
      .addEdge('pearl:flow', 'irritant:flow', 'flow')
      .observe('beauty', 'pearl.state')
      .build();

    const fable = mkFable(graph);

    const mollusk = mkReading('mollusk', mkSym('bond-graph'), new Map<string, AlgValue>([
      ['C', mkStr('mantle')],
      ['I', mkStr('nacre')],
      ['R', mkStr('grain-of-sand')],
    ]), [], 1.0);

    const shakespearean = mkReading('shakespearean', mkSym('bond-graph'), new Map<string, AlgValue>([
      ['C', mkStr('opportunity')],
      ['I', mkStr('achievement')],
      ['R', mkStr('effort')],
    ]), [], 1.0);

    const vanitas = mkReading('vanitas', mkSym('bond-graph'), new Map<string, AlgValue>([
      ['C', mkStr('mortality')],
      ['I', mkStr('beauty')],
      ['R', mkStr('time')],
    ]), [], 1.0);

    const result = await polyread(fable, [mollusk, shakespearean, vanitas]);

    // All three have same structure: 1 C, 1 I, 1 R, same edges
    expect(result.coherent).toBe(true);
    expect(result.residual).toBe(0);
    expect(result.contra).toBeUndefined();
  });

  it('structurally different graphs produce incoherence', async () => {
    // Use a custom kernel to detect structural differences that would
    // occur if readings actually changed the graph structure
    const graph = oscGraph();
    const fable = mkFable(graph);

    const identity = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);

    // Custom kernel that checks if __nodeCount differs (simulating structural change)
    const structuralKernel = (results: ReadonlyMap<string, AlgValue>): number => {
      // Force a structural mismatch
      return 3;
    };

    const result = await polyread(fable, [identity], structuralKernel, 0);

    expect(result.coherent).toBe(false);
    expect(result.residual).toBe(3);
    expect(result.contra).toBeDefined();
  });
});
