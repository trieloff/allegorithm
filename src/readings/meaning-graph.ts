/**
 * Meaning graph — the domain-neutral intermediate representation
 * that readings re-embody.
 *
 * A meaning graph is a typed graph of bond-graph primitives:
 * nodes with ports, edges with types (effort/flow/signal),
 * and observable expressions.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface MGNode {
  readonly id: string;
  /** Node type: 'I' (inertia), 'C' (compliance), 'R' (resistance),
   *  '0J' (0-junction), '1J' (1-junction), 'source', 'sensor', 'custom' */
  readonly type: string;
  readonly params: ReadonlyMap<string, number>;
  readonly ports: readonly string[];
}

export interface MGEdge {
  /** Format: "nodeId:portName" */
  readonly from: string;
  /** Format: "nodeId:portName" */
  readonly to: string;
  readonly kind: 'effort' | 'flow' | 'signal';
}

export interface MeaningGraph {
  readonly name: string;
  readonly nodes: ReadonlyMap<string, MGNode>;
  readonly edges: readonly MGEdge[];
  readonly observables: ReadonlyMap<string, string>;
}

// ── Constructors ─────────────────────────────────────────────────────

export function mkMGNode(
  id: string,
  type: string,
  params: ReadonlyMap<string, number>,
  ports: readonly string[],
): MGNode {
  return { id, type, params, ports };
}

export function mkMGEdge(from: string, to: string, kind: MGEdge['kind']): MGEdge {
  return { from, to, kind };
}

export function mkMeaningGraph(
  name: string,
  nodes: ReadonlyMap<string, MGNode>,
  edges: readonly MGEdge[],
  observables: ReadonlyMap<string, string>,
): MeaningGraph {
  return { name, nodes, edges, observables };
}

// ── Builder API ──────────────────────────────────────────────────────

export interface MGBuilder {
  addNode(id: string, type: string, params?: Record<string, number>, ports?: string[]): MGBuilder;
  addEdge(from: string, to: string, kind?: MGEdge['kind']): MGBuilder;
  observe(name: string, expression: string): MGBuilder;
  build(): MeaningGraph;
}

export function mgBuilder(name: string): MGBuilder {
  const nodes = new Map<string, MGNode>();
  const edges: MGEdge[] = [];
  const observables = new Map<string, string>();

  const builder: MGBuilder = {
    addNode(id, type, params = {}, ports = []) {
      nodes.set(id, mkMGNode(id, type, new Map(Object.entries(params)), ports));
      return builder;
    },

    addEdge(from, to, kind = 'effort') {
      edges.push(mkMGEdge(from, to, kind));
      return builder;
    },

    observe(name, expression) {
      observables.set(name, expression);
      return builder;
    },

    build() {
      return mkMeaningGraph(name, nodes, edges, observables);
    },
  };

  return builder;
}
