/**
 * Moral extraction — polymorphic (moral expr) special form.
 *
 * On a Lagrangian: detect symmetries → emit conservation law claims
 * On a Contra: return structured tension report
 * On a Fable: extract invariants from witnesses
 * On any other value: return zero-tension certificate
 */

import type { ASTNode } from '../parser/index.js';
import type { AlgValue } from '../types/index.js';
import type { EvalContext } from '../evaluator/context.js';
import type { EvalFn } from '../evaluator/specials.js';
import { mkList, mkSym, mkNum, mkStr, mkVerdict, TRUE, FALSE } from '../types/index.js';
import { isContra } from '../types/contra.js';
import { resolveLagrangian, detectSymmetries } from './lagrangian.js';

// ── Conservation law claim builders ─────────────────────────────────

/**
 * Build a conservation claim for energy.
 * Energy = ½mv² for a free particle. Check if it's constant across trace.
 */
function mkEnergyClaim(): AlgValue {
  // Tag as a claim structure: (list :tag :energy-conserved :check __closure__)
  // The claim is represented as a tagged list with a closure for checking.
  return mkList([
    mkSym('claim'),
    mkSym(':energy-conserved'),
    // The checker is a tagged atom — we handle it in the check-claim special form
    { kind: 'atom', value: '__conservation_check__:energy', isSymbol: true } as AlgValue,
  ]);
}

/**
 * Build a conservation claim for momentum.
 * Momentum = mv for a free particle. Check if it's constant across trace.
 */
function mkMomentumClaim(): AlgValue {
  return mkList([
    mkSym('claim'),
    mkSym(':momentum-conserved'),
    { kind: 'atom', value: '__conservation_check__:momentum', isSymbol: true } as AlgValue,
  ]);
}

// ── Conservation check execution ────────────────────────────────────

/**
 * Extract a numeric field from a trace snapshot (list of (key value) pairs).
 */
function getTraceField(snapshot: AlgValue, fieldName: string): number | undefined {
  if (snapshot.kind !== 'list') return undefined;
  for (const entry of snapshot.items) {
    if (entry.kind === 'list' && entry.items.length === 2) {
      const key = entry.items[0];
      const val = entry.items[1];
      if (key.kind === 'atom' && key.isSymbol && key.value === fieldName &&
          val.kind === 'atom' && typeof val.value === 'number') {
        return val.value;
      }
    }
  }
  return undefined;
}

/**
 * Check energy conservation across a trace.
 * Energy = ½mv² for each snapshot.
 */
export function checkEnergyConservation(trace: AlgValue, tolerance = 1e-10): AlgValue {
  if (trace.kind !== 'list' || trace.items.length === 0) {
    return mkVerdict(FALSE, [mkStr('empty trace')]);
  }

  const energies: number[] = [];
  for (const snapshot of trace.items) {
    const m = getTraceField(snapshot, 'm') ?? 1;
    const v = getTraceField(snapshot, 'v');
    if (v === undefined) {
      return mkVerdict(FALSE, [mkStr('missing velocity in trace snapshot')]);
    }
    energies.push(0.5 * m * v * v);
  }

  const e0 = energies[0];
  for (let i = 1; i < energies.length; i++) {
    if (Math.abs(energies[i] - e0) > tolerance) {
      return mkVerdict(FALSE, [
        mkStr(`energy not conserved: E[0]=${e0}, E[${i}]=${energies[i]}`),
      ]);
    }
  }

  return mkVerdict(TRUE, [mkStr(`energy conserved at ${e0}`)]);
}

/**
 * Check momentum conservation across a trace.
 * Momentum = mv for each snapshot.
 */
export function checkMomentumConservation(trace: AlgValue, tolerance = 1e-10): AlgValue {
  if (trace.kind !== 'list' || trace.items.length === 0) {
    return mkVerdict(FALSE, [mkStr('empty trace')]);
  }

  const momenta: number[] = [];
  for (const snapshot of trace.items) {
    const m = getTraceField(snapshot, 'm') ?? 1;
    const v = getTraceField(snapshot, 'v');
    if (v === undefined) {
      return mkVerdict(FALSE, [mkStr('missing velocity in trace snapshot')]);
    }
    momenta.push(m * v);
  }

  const p0 = momenta[0];
  for (let i = 1; i < momenta.length; i++) {
    if (Math.abs(momenta[i] - p0) > tolerance) {
      return mkVerdict(FALSE, [
        mkStr(`momentum not conserved: p[0]=${p0}, p[${i}]=${momenta[i]}`),
      ]);
    }
  }

  return mkVerdict(TRUE, [mkStr(`momentum conserved at ${p0}`)]);
}

// ── Special form: moral ─────────────────────────────────────────────

/**
 * (moral expr) — polymorphic moral extraction
 */
export async function handleMoral(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 1) throw new Error('moral requires exactly 1 argument');
  const val = await evalExpr(args[0], ctx);

  // 1. On a Lagrangian reference: detect symmetries → conservation law claims
  const lagrangian = resolveLagrangian(val);
  if (lagrangian) {
    const symmetries = detectSymmetries(lagrangian);
    const claims: AlgValue[] = [];

    for (const sym of symmetries) {
      if (sym.conservedQuantity === 'energy') {
        claims.push(mkEnergyClaim());
      } else if (sym.conservedQuantity === 'momentum') {
        claims.push(mkMomentumClaim());
      }
    }

    return mkList(claims);
  }

  // 2. On a Contra: return structured tension report
  if (isContra(val)) {
    return mkList([
      mkSym('tension-report'),
      mkList([mkSym('tension'), mkNum(val.tension)]),
      mkList([mkSym('yes'), val.yes]),
      mkList([mkSym('no'), val.no]),
      mkList([mkSym('site'), mkStr(val.site)]),
    ]);
  }

  // 3. On a Fable: extract witnesses as invariants
  if (val.kind === 'fable') {
    // Fable's graph is opaque, but if it has been read, the reading carries witnesses
    // For now, return the fable's structure info
    return mkList([mkSym('fable-invariants')]);
  }

  // 4. On a Reading: extract witness constraints
  if (val.kind === 'reading') {
    const witnessValues = val.witnesses.length > 0
      ? val.witnesses
      : [mkSym('no-witnesses')];
    return mkList([mkSym('reading-invariants'), ...witnessValues]);
  }

  // 5. On any other value: zero-tension certificate
  return mkList([mkSym('zero-tension')]);
}

// ── Special form: check-conservation ────────────────────────────────

/**
 * (check-conservation claim trace) — apply a conservation claim to a trace
 *
 * claim is a list: (claim :name checker-atom)
 * trace is a list of snapshots from simulate-lagrangian
 */
export async function handleCheckConservation(
  args: ASTNode[],
  ctx: EvalContext,
  evalExpr: EvalFn,
): Promise<AlgValue> {
  if (args.length !== 2) throw new Error('check-conservation requires exactly 2 arguments');

  const claim = await evalExpr(args[0], ctx);
  const trace = await evalExpr(args[1], ctx);

  if (claim.kind !== 'list' || claim.items.length < 3) {
    throw new Error('check-conservation: claim must be a (claim :name checker) list');
  }

  const checker = claim.items[2];
  if (checker.kind !== 'atom' || typeof checker.value !== 'string') {
    throw new Error('check-conservation: invalid checker');
  }

  const checkerName = (checker.value as string);
  if (checkerName === '__conservation_check__:energy') {
    return checkEnergyConservation(trace);
  } else if (checkerName === '__conservation_check__:momentum') {
    return checkMomentumConservation(trace);
  }

  throw new Error(`check-conservation: unknown checker "${checkerName}"`);
}
