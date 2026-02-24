import { describe, it, expect } from 'vitest';
import { mgBuilder, mkMGNode, mkMGEdge, mkMeaningGraph } from '../../src/readings/meaning-graph.js';

describe('MeaningGraph constructors', () => {
  it('mkMGNode creates a node with params and ports', () => {
    const node = mkMGNode('m', 'I', new Map([['mass', 1]]), ['effort', 'flow']);
    expect(node.id).toBe('m');
    expect(node.type).toBe('I');
    expect(node.params.get('mass')).toBe(1);
    expect(node.ports).toEqual(['effort', 'flow']);
  });

  it('mkMGEdge creates an edge', () => {
    const edge = mkMGEdge('a:effort', 'b:effort', 'effort');
    expect(edge.from).toBe('a:effort');
    expect(edge.to).toBe('b:effort');
    expect(edge.kind).toBe('effort');
  });

  it('mkMeaningGraph creates a graph', () => {
    const nodes = new Map([['m', mkMGNode('m', 'I', new Map(), ['effort', 'flow'])]]);
    const edges = [mkMGEdge('m:effort', 'k:effort', 'effort')];
    const observables = new Map([['x', 'integrate flow']]);
    const graph = mkMeaningGraph('osc', nodes, edges, observables);
    expect(graph.name).toBe('osc');
    expect(graph.nodes.size).toBe(1);
    expect(graph.edges.length).toBe(1);
    expect(graph.observables.get('x')).toBe('integrate flow');
  });
});

describe('mgBuilder', () => {
  it('builds a simple meaning graph with chained API', () => {
    const graph = mgBuilder('oscillator')
      .addNode('m', 'I', { mass: 1 }, ['effort', 'flow'])
      .addNode('k', 'C', { stiffness: 4 }, ['effort', 'flow'])
      .addNode('c', 'R', { damping: 0.2 }, ['effort', 'flow'])
      .addNode('j', '1J', {}, ['effort', 'flow'])
      .addEdge('j:effort', 'm:effort', 'effort')
      .addEdge('j:effort', 'k:effort', 'effort')
      .addEdge('j:effort', 'c:effort', 'effort')
      .observe('x', 'integrate flow')
      .observe('P', 'power effort flow')
      .build();

    expect(graph.name).toBe('oscillator');
    expect(graph.nodes.size).toBe(4);
    expect(graph.edges.length).toBe(3);
    expect(graph.observables.size).toBe(2);

    const mNode = graph.nodes.get('m');
    expect(mNode).toBeDefined();
    expect(mNode!.type).toBe('I');
    expect(mNode!.params.get('mass')).toBe(1);

    const kNode = graph.nodes.get('k');
    expect(kNode).toBeDefined();
    expect(kNode!.type).toBe('C');
    expect(kNode!.params.get('stiffness')).toBe(4);
  });

  it('supports default edge kind (effort)', () => {
    const graph = mgBuilder('test')
      .addNode('a', 'source', {}, ['effort'])
      .addNode('b', 'I', {}, ['effort', 'flow'])
      .addEdge('a:effort', 'b:effort')
      .build();

    expect(graph.edges[0].kind).toBe('effort');
  });

  it('supports default empty params and ports', () => {
    const graph = mgBuilder('test')
      .addNode('j', '0J')
      .build();

    const node = graph.nodes.get('j');
    expect(node).toBeDefined();
    expect(node!.params.size).toBe(0);
    expect(node!.ports).toEqual([]);
  });
});
