/**
 * Environment operations — immutable lexical scope with parent chain.
 */

import type { Environment, AlgValue } from '../types/index.js';
import { extendEnv } from '../types/index.js';

/** Walk the parent chain looking for a binding. */
export function envLookup(env: Environment, name: string): AlgValue | undefined {
  let current: Environment | null = env;
  while (current !== null) {
    const val = current.bindings.get(name);
    if (val !== undefined) return val;
    current = current.parent;
  }
  return undefined;
}

/** Create a new environment with an additional binding (immutable). */
export function envSet(env: Environment, name: string, value: AlgValue): Environment {
  const bindings = new Map(env.bindings);
  bindings.set(name, value);
  return { bindings, parent: env.parent };
}
