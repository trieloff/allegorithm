import { describe, it, expect } from 'vitest';
import { mgBuilder } from '../../src/readings/meaning-graph.js';
import { applyReading, executeWitnesses } from '../../src/readings/reading.js';
import { mkReading, mkSym, mkStr, mkVerdict, TRUE, FALSE } from '../../src/types/index.js';

/** Build the canonical mechanical oscillator graph. */
function mechOscillator() {
  return mgBuilder('mech-osc')
    .addNode('m', 'I', { m: 1 }, ['effort', 'flow'])
    .addNode('k', 'C', { k: 4 }, ['effort', 'flow'])
    .addNode('c', 'R', { c: 0.2 }, ['effort', 'flow'])
    .addNode('j', '1J', {}, ['effort', 'flow'])
    .addEdge('j:effort', 'm:effort', 'effort')
    .addEdge('j:effort', 'k:effort', 'effort')
    .addEdge('j:flow', 'c:flow', 'flow')
    .observe('x', 'integrate flow')
    .observe('P', 'power effort flow')
    .build();
}

/** Mechanical → Electrical reading map. */
function mechToElecMap(): ReadonlyMap<string, import('../../src/types/values.js').AlgValue> {
  return new Map([
    ['I', mkStr('L')],        // inertia → inductance
    ['C', mkStr('C_elec')],   // compliance → capacitance
    ['R', mkStr('R_elec')],   // resistance → resistance
    ['effort', mkStr('voltage')],
    ['flow', mkStr('current')],
    ['1J', mkStr('1J')],      // junction stays the same
  ]);
}

describe('applyReading', () => {
  it('renames node types according to the reading map', () => {
    const graph = mechOscillator();
    const reading = mkReading('mech->elec', mkSym('bond-graph'), mechToElecMap(), [], 1.0);
    const reread = applyReading(graph, reading);

    expect(reread.nodes.get('m')!.type).toBe('L');
    expect(reread.nodes.get('k')!.type).toBe('C_elec');
    expect(reread.nodes.get('c')!.type).toBe('R_elec');
    expect(reread.nodes.get('j')!.type).toBe('1J');
  });

  it('remaps port names', () => {
    const graph = mechOscillator();
    const reading = mkReading('mech->elec', mkSym('bond-graph'), mechToElecMap(), [], 1.0);
    const reread = applyReading(graph, reading);

    expect(reread.nodes.get('m')!.ports).toEqual(['voltage', 'current']);
  });

  it('remaps observable expressions', () => {
    const graph = mechOscillator();
    const reading = mkReading('mech->elec', mkSym('bond-graph'), mechToElecMap(), [], 1.0);
    const reread = applyReading(graph, reading);

    expect(reread.observables.get('x')).toBe('integrate current');
    expect(reread.observables.get('P')).toBe('power voltage current');
  });

  it('remaps edge kinds', () => {
    const graph = mechOscillator();
    const reading = mkReading('mech->elec', mkSym('bond-graph'), mechToElecMap(), [], 1.0);
    const reread = applyReading(graph, reading);

    const effortEdges = reread.edges.filter(e => e.kind === 'voltage' as any);
    const flowEdges = reread.edges.filter(e => e.kind === 'current' as any);
    expect(effortEdges.length).toBe(2);
    expect(flowEdges.length).toBe(1);
  });

  it('preserves unmapped values', () => {
    const graph = mgBuilder('test')
      .addNode('x', 'custom', { alpha: 42 }, ['data'])
      .observe('out', 'read data')
      .build();

    // Empty map: nothing changes
    const reading = mkReading('identity', mkSym('bond-graph'), new Map(), [], 1.0);
    const reread = applyReading(graph, reading);

    expect(reread.nodes.get('x')!.type).toBe('custom');
    expect(reread.nodes.get('x')!.params.get('alpha')).toBe(42);
    expect(reread.observables.get('out')).toBe('read data');
  });
});

describe('executeWitnesses', () => {
  it('returns TRUE for witnesses that match node IDs', () => {
    const graph = mechOscillator();
    const reading = mkReading('test', mkSym('bond-graph'), new Map(), [mkSym('m'), mkSym('k')], 1.0);
    const verdicts = executeWitnesses(graph, reading);

    expect(verdicts.length).toBe(2);
    expect(verdicts[0].bits).toBe(TRUE);
    expect(verdicts[1].bits).toBe(TRUE);
  });

  it('returns TRUE for witnesses that match observable names', () => {
    const graph = mechOscillator();
    const reading = mkReading('test', mkSym('bond-graph'), new Map(), [mkSym('x'), mkSym('P')], 1.0);
    const verdicts = executeWitnesses(graph, reading);

    expect(verdicts[0].bits).toBe(TRUE);
    expect(verdicts[1].bits).toBe(TRUE);
  });

  it('returns FALSE for witnesses that match nothing', () => {
    const graph = mechOscillator();
    const reading = mkReading('test', mkSym('bond-graph'), new Map(), [mkSym('nonexistent')], 1.0);
    const verdicts = executeWitnesses(graph, reading);

    expect(verdicts[0].bits).toBe(FALSE);
  });

  it('returns TRUE for string witnesses matching node types', () => {
    const graph = mechOscillator();
    const reading = mkReading('test', mkSym('bond-graph'), new Map(), [mkStr('I'), mkStr('C')], 1.0);
    const verdicts = executeWitnesses(graph, reading);

    expect(verdicts[0].bits).toBe(TRUE);
    expect(verdicts[1].bits).toBe(TRUE);
  });
});
