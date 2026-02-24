import { describe, it, expect } from 'vitest';
import {
  mkAuthority, mkAttestation, mkStr,
  dominates, clearlyDominates, effectiveRank, mkCourt,
} from '../../src/types/index.js';

describe('effectiveRank', () => {
  const secCourt = mkCourt('security', new Map([
    ['security-cert', 2.0],
    ['threat-modeling', 1.5],
  ]));

  it('multiplies base rank by credential weight sum', () => {
    const auth = mkAuthority('Alice', 'human', ['security-cert', 'threat-modeling'], 10);
    // 10 * (2.0 + 1.5) = 35
    expect(effectiveRank(auth, secCourt)).toBe(35);
  });

  it('returns 0 when authority has no recognised credentials', () => {
    const auth = mkAuthority('Bob', 'human', ['ux-design'], 10);
    expect(effectiveRank(auth, secCourt)).toBe(0);
  });

  it('returns 0 when authority has zero base rank', () => {
    const auth = mkAuthority('Zero', 'system', ['security-cert'], 0);
    expect(effectiveRank(auth, secCourt)).toBe(0);
  });
});

describe('dominates', () => {
  const secCourt = mkCourt('security', new Map([
    ['security-cert', 2.0],
  ]));

  const uxCourt = mkCourt('ux', new Map([
    ['ux-design', 3.0],
  ]));

  const secLead = mkAuthority('Alice', 'human', ['security-cert'], 10);
  const uxLead = mkAuthority('Bob', 'human', ['ux-design'], 10);
  const junior = mkAuthority('Charlie', 'human', ['security-cert'], 3);

  it('security lead dominates junior in security court', () => {
    const degree = dominates(secLead, junior, secCourt);
    // 20 / (20 + 6) = 0.769...
    expect(degree).toBeGreaterThan(0.7);
    expect(degree).toBeLessThan(0.8);
  });

  it('junior is subordinate in security court', () => {
    const degree = dominates(junior, secLead, secCourt);
    expect(degree).toBeLessThan(0.3);
  });

  it('security lead and UX lead are incomparable in security court (UX has no cred)', () => {
    // UX lead has no security credentials → effective rank 0
    // secLead has rank > 0, so degree = 20 / (20 + 0) = 1.0
    // But uxLead in ux court vs secLead:
    const degree = dominates(uxLead, secLead, secCourt);
    // uxLead has 0 effective rank in security, secLead has 20
    expect(degree).toBe(0); // 0 / (0 + 20)
  });

  it('neither has jurisdiction → returns 0.5', () => {
    const randomCourt = mkCourt('cooking', new Map([['chef-cert', 1.0]]));
    const degree = dominates(secLead, uxLead, randomCourt);
    expect(degree).toBe(0.5);
  });

  it('equal authorities in same court → returns 0.5', () => {
    const auth1 = mkAuthority('A', 'human', ['security-cert'], 10);
    const auth2 = mkAuthority('B', 'human', ['security-cert'], 10);
    expect(dominates(auth1, auth2, secCourt)).toBe(0.5);
  });

  it('returns value in [0, 1] for all inputs', () => {
    const auths = [secLead, uxLead, junior];
    const courts = [secCourt, uxCourt];

    for (const a of auths)
      for (const b of auths)
        for (const c of courts) {
          const d = dominates(a, b, c);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(1);
        }
  });
});

describe('clearlyDominates', () => {
  const court = mkCourt('security', new Map([['security-cert', 2.0]]));
  const lead = mkAuthority('Alice', 'human', ['security-cert'], 10);
  const junior = mkAuthority('Charlie', 'human', ['security-cert'], 3);

  it('returns true when degree exceeds threshold', () => {
    expect(clearlyDominates(lead, junior, court)).toBe(true);
  });

  it('returns false when degree is below threshold', () => {
    expect(clearlyDominates(junior, lead, court)).toBe(false);
  });

  it('respects custom threshold', () => {
    // degree ≈ 0.77
    expect(clearlyDominates(lead, junior, court, 0.9)).toBe(false);
    expect(clearlyDominates(lead, junior, court, 0.6)).toBe(true);
  });
});

describe('mkAttestation', () => {
  it('creates an attestation with authority, claim, and court', () => {
    const auth = mkAuthority('Alice', 'human', ['security-cert'], 10);
    const claim = mkStr('system is secure');
    const att = mkAttestation(auth, claim, 'security');

    expect(att.kind).toBe('attestation');
    expect(att.authority).toBe(auth);
    expect(att.claim).toBe(claim);
    expect(att.court).toBe('security');
  });
});
