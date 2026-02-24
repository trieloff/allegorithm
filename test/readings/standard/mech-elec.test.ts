import { describe, it, expect } from 'vitest';
import {
  createOscillatorFable,
  createMechReading,
  createElecReading,
  witnessDimensionalConsistency,
  witnessTopologyIsomorphism,
} from '../../../src/readings/standard/mech-elec.js';
import { applyReading } from '../../../src/readings/reading.js';
import { polyread } from '../../../src/readings/polyread.js';
import { mkFable, mkReading, mkSym, TRUE } from '../../../src/types/values.js';
import type { AlgValue } from '../../../src/types/values.js';

describe('mech↔elec standard reading', () => {
  const graph = createOscillatorFable();
  const mechReading = createMechReading();
  const elecReading = createElecReading();

  describe('oscillator fable', () => {
    it('creates correctly with 3 elements + junction', () => {
      expect(graph.nodes.size).toBe(4);

      // Check element types
      const types = [...graph.nodes.values()].map(n => n.type).sort();
      expect(types).toEqual(['1J', 'C', 'I', 'R']);
    });

    it('has effort and flow edges', () => {
      expect(graph.edges.length).toBe(6);

      const effortEdges = graph.edges.filter(e => e.kind === 'effort');
      const flowEdges = graph.edges.filter(e => e.kind === 'flow');
      expect(effortEdges.length).toBe(3);
      expect(flowEdges.length).toBe(3);
    });

    it('has power and energy observables', () => {
      expect(graph.observables.has('power')).toBe(true);
      expect(graph.observables.has('energy_stored')).toBe(true);
      expect(graph.observables.get('power')).toBe('effort * flow');
    });
  });

  describe('mechanical reading', () => {
    it('remaps I→mass, C→spring, R→damper', () => {
      const reread = applyReading(graph, mechReading);

      const types = new Set([...reread.nodes.values()].map(n => n.type));
      expect(types.has('mass')).toBe(true);
      expect(types.has('spring')).toBe(true);
      expect(types.has('damper')).toBe(true);
    });

    it('remaps effort→Force, flow→Velocity in ports', () => {
      const reread = applyReading(graph, mechReading);

      for (const node of reread.nodes.values()) {
        for (const port of node.ports) {
          expect(['Force', 'Velocity']).toContain(port);
        }
      }
    });
  });

  describe('electrical reading', () => {
    it('remaps I→inductor, C→capacitor, R→resistor', () => {
      const reread = applyReading(graph, elecReading);

      const types = new Set([...reread.nodes.values()].map(n => n.type));
      expect(types.has('inductor')).toBe(true);
      expect(types.has('capacitor')).toBe(true);
      expect(types.has('resistor')).toBe(true);
    });

    it('remaps effort→Voltage, flow→Current in ports', () => {
      const reread = applyReading(graph, elecReading);

      for (const node of reread.nodes.values()) {
        for (const port of node.ports) {
          expect(['Voltage', 'Current']).toContain(port);
        }
      }
    });
  });

  describe('polyread coherence', () => {
    it('mech + elec readings are structurally coherent (residual 0)', async () => {
      const fable = mkFable(graph);
      const result = await polyread(fable, [mechReading, elecReading]);

      expect(result.coherent).toBe(true);
      expect(result.residual).toBe(0);
      expect(result.contra).toBeUndefined();
    });

    it('identity + mech-to-elec are coherent (same structure)', async () => {
      const fable = mkFable(graph);
      const identity = mkReading('identity', mkSym('bond-graph'), new Map<string, AlgValue>(), [], 1.0);
      const result = await polyread(fable, [identity, elecReading]);

      expect(result.coherent).toBe(true);
      expect(result.residual).toBe(0);
    });
  });

  describe('witnesses', () => {
    it('dimensional consistency: effort × flow = power (mechanical)', () => {
      const verdict = witnessDimensionalConsistency(graph, mechReading);
      expect(verdict.bits).toBe(TRUE);
      expect(verdict.why.length).toBeGreaterThan(0);
    });

    it('dimensional consistency: effort × flow = power (electrical)', () => {
      const verdict = witnessDimensionalConsistency(graph, elecReading);
      expect(verdict.bits).toBe(TRUE);
    });

    it('topology isomorphism: mech and elec have same structure', () => {
      const verdict = witnessTopologyIsomorphism(graph, mechReading, elecReading);
      expect(verdict.bits).toBe(TRUE);
    });
  });
});
