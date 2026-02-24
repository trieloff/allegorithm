import { describe, it, expect } from 'vitest';
import {
  createNetworkFable,
  createCircuitReading,
  createMarkovReading,
  witnessKirchhoffConservation,
  witnessCommuteTimeIdentity,
} from '../../../src/readings/standard/network-markov.js';
import { applyReading } from '../../../src/readings/reading.js';
import { polyread } from '../../../src/readings/polyread.js';
import { mkFable, TRUE } from '../../../src/types/values.js';

describe('network↔markov standard reading', () => {
  const graph = createNetworkFable();
  const circuitReading = createCircuitReading();
  const markovReading = createMarkovReading();

  describe('network fable', () => {
    it('creates with 4 junction nodes and 4 resistor edges', () => {
      const junctions = [...graph.nodes.values()].filter(n => n.type === '0J');
      const resistors = [...graph.nodes.values()].filter(n => n.type === 'R');

      expect(junctions.length).toBe(4);
      expect(resistors.length).toBe(4);
      expect(graph.nodes.size).toBe(8); // 4 junctions + 4 resistors
    });

    it('has 8 edges connecting the network', () => {
      expect(graph.edges.length).toBe(8);
    });

    it('has conservation and total_conductance observables', () => {
      expect(graph.observables.has('conservation')).toBe(true);
      expect(graph.observables.has('total_conductance')).toBe(true);
    });
  });

  describe('circuit reading', () => {
    it('maps R→resistor, 0J→node', () => {
      const reread = applyReading(graph, circuitReading);

      const types = new Set([...reread.nodes.values()].map(n => n.type));
      expect(types.has('resistor')).toBe(true);
      expect(types.has('node')).toBe(true);
      expect(types.has('R')).toBe(false);
      expect(types.has('0J')).toBe(false);
    });

    it('maps effort→voltage, flow→current in ports', () => {
      const reread = applyReading(graph, circuitReading);

      for (const node of reread.nodes.values()) {
        for (const port of node.ports) {
          expect(['voltage', 'current']).toContain(port);
        }
      }
    });

    it('maps resistance parameter to ohms', () => {
      const reread = applyReading(graph, circuitReading);
      const resistors = [...reread.nodes.values()].filter(n => n.type === 'resistor');

      for (const r of resistors) {
        expect(r.params.has('ohms')).toBe(true);
      }
    });
  });

  describe('markov reading', () => {
    it('maps R→edge, 0J→state', () => {
      const reread = applyReading(graph, markovReading);

      const types = new Set([...reread.nodes.values()].map(n => n.type));
      expect(types.has('edge')).toBe(true);
      expect(types.has('state')).toBe(true);
    });

    it('maps resistance to transition-weight', () => {
      const reread = applyReading(graph, markovReading);
      const edges = [...reread.nodes.values()].filter(n => n.type === 'edge');

      for (const e of edges) {
        expect(e.params.has('transition-weight')).toBe(true);
      }
    });
  });

  describe('polyread coherence', () => {
    it('circuit + markov readings are structurally coherent', async () => {
      const fable = mkFable(graph);
      const result = await polyread(fable, [circuitReading, markovReading]);

      expect(result.coherent).toBe(true);
      expect(result.residual).toBe(0);
      expect(result.contra).toBeUndefined();
    });
  });

  describe('witnesses', () => {
    it('Kirchhoff conservation: balanced flow at all junctions', () => {
      const verdict = witnessKirchhoffConservation(graph);
      expect(verdict.bits).toBe(TRUE);
    });

    it('commute-time identity: structural prerequisites satisfied', () => {
      const verdict = witnessCommuteTimeIdentity(graph);
      expect(verdict.bits).toBe(TRUE);

      // Should report 4 resistors, 4 nodes, positive conductance
      const evidence = verdict.why[0];
      expect(evidence.kind).toBe('atom');
      if (evidence.kind === 'atom') {
        expect(String(evidence.value)).toContain('4 resistors');
        expect(String(evidence.value)).toContain('4 nodes');
      }
    });
  });
});
