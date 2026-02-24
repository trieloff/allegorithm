/**
 * Compile a `deffable` body into a MeaningGraph.
 *
 * The `deffable` form:
 * ```
 * (deffable osc
 *   (ports (drive :effort) (sense :flow))
 *   (I m 1 kg)
 *   (C k 4 N/m)
 *   (R c 0.2 N*s/m)
 *   (1J j)
 *   (connect drive j)
 *   (connect j (I m) (C k) (R c))
 *   (observe x (integrate sense))
 *   (observe P (power drive sense)))
 * ```
 *
 * Each bond-graph element (I, C, R, 0J, 1J) becomes a node.
 * `connect` creates edges. `observe` creates observables.
 * `ports` declares the fable's interface.
 */

import type { ASTNode, ListNode } from '../parser/ast.js';
import type { MeaningGraph } from './meaning-graph.js';
import { mgBuilder } from './meaning-graph.js';

/** Known bond-graph element types that become nodes. */
const ELEMENT_TYPES = new Set(['I', 'C', 'R', '0J', '1J', 'source', 'sensor']);

/** Extract a symbol name from an AST node, or null. */
function symName(node: ASTNode): string | null {
  return node.type === 'symbol' ? node.name : null;
}

/** Extract a number value from an AST node, or null. */
function numVal(node: ASTNode): number | null {
  return node.type === 'number' ? node.value : null;
}

/** Collect remaining elements as a joined string (for units like "N/m"). */
function restAsString(elements: ASTNode[], startIdx: number): string {
  return elements.slice(startIdx).map(e => {
    if (e.type === 'symbol') return e.name;
    if (e.type === 'number') return String(e.value);
    if (e.type === 'string') return e.value;
    return '';
  }).join(' ');
}

/**
 * Compile a list of AST forms (the body of a deffable) into a MeaningGraph.
 *
 * @param name  The fable name
 * @param body  The AST nodes inside the (deffable name ...) form
 */
export function compileFable(name: string, body: ASTNode[]): MeaningGraph {
  const builder = mgBuilder(name);
  const portDefs: Array<{ name: string; kind: string }> = [];
  const connections: Array<{ from: string; targets: string[] }> = [];

  // Track node IDs created by element declarations for connect resolution
  const elementNodes = new Map<string, string>(); // localName → nodeId

  for (const form of body) {
    if (form.type !== 'list') continue;
    const els = form.elements;
    if (els.length === 0) continue;

    const head = symName(els[0]);
    if (!head) continue;

    if (head === 'ports') {
      // (ports (drive :effort) (sense :flow))
      for (let i = 1; i < els.length; i++) {
        const portSpec = els[i];
        if (portSpec.type === 'list' && portSpec.elements.length >= 2) {
          const pName = symName(portSpec.elements[0]);
          const pKind = symName(portSpec.elements[1]);
          if (pName && pKind) {
            const kind = pKind.startsWith(':') ? pKind.slice(1) : pKind;
            portDefs.push({ name: pName, kind });
            // Ports become source/sensor nodes
            const portType = kind === 'effort' ? 'source' : 'sensor';
            builder.addNode(pName, portType, {}, [kind]);
            elementNodes.set(pName, pName);
          }
        }
      }
    } else if (ELEMENT_TYPES.has(head)) {
      // (I m 1 kg) or (1J j) — bond-graph element declaration
      const localName = symName(els[1]);
      if (!localName) continue;

      const params: Record<string, number> = {};
      const val = els.length > 2 ? numVal(els[2]) : null;
      if (val !== null) {
        // Use the unit string as part of param name for now
        const unit = els.length > 3 ? restAsString(els, 3) : '';
        params[localName] = val;
      }

      // Ports depend on element type
      let ports: string[];
      switch (head) {
        case 'I':
        case 'C':
        case 'R':
          ports = ['effort', 'flow'];
          break;
        case '0J':
        case '1J':
          ports = ['effort', 'flow']; // junctions have multiple ports, simplified
          break;
        case 'source':
          ports = ['effort'];
          break;
        case 'sensor':
          ports = ['flow'];
          break;
        default:
          ports = [];
      }

      builder.addNode(localName, head, params, ports);
      elementNodes.set(localName, localName);
    } else if (head === 'connect') {
      // (connect drive j) or (connect j (I m) (C k) (R c))
      const fromRef = resolveRef(els[1], elementNodes);
      if (!fromRef) continue;

      const targets: string[] = [];
      for (let i = 2; i < els.length; i++) {
        const targetRef = resolveRef(els[i], elementNodes);
        if (targetRef) targets.push(targetRef);
      }
      connections.push({ from: fromRef, targets });
    } else if (head === 'observe') {
      // (observe x (integrate sense))
      const obsName = symName(els[1]);
      if (!obsName) continue;

      // Collect the expression as a string representation
      const exprParts = els.slice(2).map(astToString);
      builder.observe(obsName, exprParts.join(' '));
    }
  }

  // Convert connections to edges
  for (const conn of connections) {
    for (const target of conn.targets) {
      // Default edge kind is 'effort' for bond-graph connections
      builder.addEdge(`${conn.from}:effort`, `${target}:effort`, 'effort');
      builder.addEdge(`${conn.from}:flow`, `${target}:flow`, 'flow');
    }
  }

  return builder.build();
}

/** Resolve a reference — either a plain symbol or a (Type name) list. */
function resolveRef(node: ASTNode, elementNodes: Map<string, string>): string | null {
  if (node.type === 'symbol') {
    return elementNodes.get(node.name) ?? node.name;
  }
  if (node.type === 'list' && node.elements.length >= 2) {
    // (I m) → refers to the node named "m" of type "I"
    const localName = symName(node.elements[1]);
    return localName ? (elementNodes.get(localName) ?? localName) : null;
  }
  return null;
}

/** Convert an AST node back to a string representation. */
function astToString(node: ASTNode): string {
  switch (node.type) {
    case 'number': return String(node.value);
    case 'string': return `"${node.value}"`;
    case 'symbol': return node.name;
    case 'list': return `(${node.elements.map(astToString).join(' ')})`;
  }
}
