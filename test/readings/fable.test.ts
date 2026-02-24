import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parser/parser.js';
import { compileFable } from '../../src/readings/fable.js';
import type { ListNode } from '../../src/parser/ast.js';

describe('compileFable', () => {
  it('parses a simple deffable body into a MeaningGraph', () => {
    const source = `
      (ports (drive :effort) (sense :flow))
      (I m 1 kg)
      (C k 4 N/m)
      (R c 0.2 Ns/m)
      (1J j)
      (connect drive j)
      (connect j (I m) (C k) (R c))
      (observe x (integrate sense))
      (observe P (power drive sense))
    `;
    const ast = parse(source);
    const graph = compileFable('osc', ast);

    expect(graph.name).toBe('osc');

    // Ports become nodes
    expect(graph.nodes.has('drive')).toBe(true);
    expect(graph.nodes.get('drive')!.type).toBe('source');
    expect(graph.nodes.has('sense')).toBe(true);
    expect(graph.nodes.get('sense')!.type).toBe('sensor');

    // Bond-graph elements become nodes
    expect(graph.nodes.has('m')).toBe(true);
    expect(graph.nodes.get('m')!.type).toBe('I');
    expect(graph.nodes.has('k')).toBe(true);
    expect(graph.nodes.get('k')!.type).toBe('C');
    expect(graph.nodes.has('c')).toBe(true);
    expect(graph.nodes.get('c')!.type).toBe('R');
    expect(graph.nodes.has('j')).toBe(true);
    expect(graph.nodes.get('j')!.type).toBe('1J');

    // Total nodes: 2 ports + 4 elements = 6
    expect(graph.nodes.size).toBe(6);
  });

  it('creates edges from connect statements', () => {
    const source = `
      (I m 1 kg)
      (C k 4 N/m)
      (1J j)
      (connect j (I m) (C k))
    `;
    const ast = parse(source);
    const graph = compileFable('test', ast);

    // connect j (I m) (C k) creates 2 edge pairs (effort + flow each)
    expect(graph.edges.length).toBe(4);

    // Check that edges reference correct nodes
    const fromNodes = graph.edges.map(e => e.from.split(':')[0]);
    expect(fromNodes).toContain('j');
    const toNodes = graph.edges.map(e => e.to.split(':')[0]);
    expect(toNodes).toContain('m');
    expect(toNodes).toContain('k');
  });

  it('creates observables from observe statements', () => {
    const source = `
      (observe x (integrate sense))
      (observe P (power drive sense))
    `;
    const ast = parse(source);
    const graph = compileFable('test', ast);

    expect(graph.observables.size).toBe(2);
    expect(graph.observables.get('x')).toBe('(integrate sense)');
    expect(graph.observables.get('P')).toBe('(power drive sense)');
  });

  it('handles element parameters correctly', () => {
    const source = `
      (I m 1 kg)
      (C k 4 N/m)
      (R c 0.2 Ns/m)
    `;
    const ast = parse(source);
    const graph = compileFable('test', ast);

    expect(graph.nodes.get('m')!.params.get('m')).toBe(1);
    expect(graph.nodes.get('k')!.params.get('k')).toBe(4);
    expect(graph.nodes.get('c')!.params.get('c')).toBe(0.2);
  });

  it('handles junctions without parameters', () => {
    const source = `(0J j0) (1J j1)`;
    const ast = parse(source);
    const graph = compileFable('junctions', ast);

    expect(graph.nodes.get('j0')!.type).toBe('0J');
    expect(graph.nodes.get('j0')!.params.size).toBe(0);
    expect(graph.nodes.get('j1')!.type).toBe('1J');
  });
});
