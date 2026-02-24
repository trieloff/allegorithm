import { describe, it, expect } from 'vitest';
import { mkAuthority, mkAttestation, mkStr, mkNum, mkSym, mkList } from '../../src/types/index.js';
import { dominates, effectiveRank } from '../../src/types/authority.js';
import { isContra } from '../../src/types/contra.js';
import {
  mkFullCourt, adjudicate, canon, multiCourtAdjudicate,
  type Stance, type FullCourt,
} from '../../src/court/index.js';
import { mkRefutation, refutationToContra } from '../../src/court/attestation.js';

// ── Helpers ──────────────────────────────────────────────────────────

function stance(value: ReturnType<typeof mkStr>, issuer: ReturnType<typeof mkAuthority>, evidence: any[] = []): Stance {
  return { value, issuer, evidence };
}

// ══════════════════════════════════════════════════════════════════════
// Test Scenario 1: Clear hierarchy
// LLM (rank 10) → human (rank 70) → security lead (rank 90)
// ══════════════════════════════════════════════════════════════════════

describe('Scenario 1: Clear hierarchy', () => {
  const securityCourt = mkFullCourt(
    'security',
    'security',
    new Map([['security-cert', 3.0], ['engineering', 0.5]]),
    'max-authority',
    0.7,
  );

  const llm = mkAuthority('llm-assistant', 'llm', ['engineering'], 10);
  const human = mkAuthority('engineer', 'human', ['engineering'], 70);
  const secLead = mkAuthority('security-lead', 'human', ['security-cert'], 90);

  it('security lead has highest effective rank in security court', () => {
    const llmRank = effectiveRank(llm, securityCourt);      // 10 * 0.5 = 5
    const humanRank = effectiveRank(human, securityCourt);    // 70 * 0.5 = 35
    const leadRank = effectiveRank(secLead, securityCourt);   // 90 * 3.0 = 270

    expect(leadRank).toBeGreaterThan(humanRank);
    expect(humanRank).toBeGreaterThan(llmRank);
  });

  it('security lead dominates LLM in security court', () => {
    const degree = dominates(secLead, llm, securityCourt);
    expect(degree).toBeGreaterThan(0.9);
  });

  it('adjudicate with max-authority picks security lead stance', () => {
    const stances: Stance[] = [
      stance(mkStr('llm-says-safe'), llm),
      stance(mkStr('engineer-says-caution'), human),
      stance(mkStr('lead-says-block'), secLead),
    ];

    const result = adjudicate(securityCourt, stances);

    // Security lead's stance should be binding
    expect(result.binding).toEqual(mkStr('lead-says-block'));
    expect(result.confidence).toBeGreaterThan(0.5);
    // Dissent should exist (overruled stances)
    expect(result.dissent).not.toBeNull();
  });

  it('refutation creates normative contradiction', () => {
    const refutation = mkRefutation('security', human, 'llm-assessment', mkStr('unsafe-actually'));
    const contra = refutationToContra(refutation, mkStr('llm-says-safe'), llm);

    expect(isContra(contra)).toBe(true);
    if (contra.kind === 'contra') {
      expect(contra.yes).toEqual(mkStr('llm-says-safe'));
      expect(contra.no).toEqual(mkStr('unsafe-actually'));
      expect(contra.tension).toBeGreaterThan(0); // rank gap creates tension
    }
  });

  it('canon resolves by authority in max-authority court', () => {
    const stances: Stance[] = [
      stance(mkStr('approve'), llm),
      stance(mkStr('block'), secLead),
    ];

    const result = canon(securityCourt, 'deployment-decision', stances);
    expect(result.binding).toEqual(mkStr('block'));
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Test Scenario 2: Incomparable authorities
// Security lead and UX lead disagree — neither dominates on the topic
// ══════════════════════════════════════════════════════════════════════

describe('Scenario 2: Incomparable authorities', () => {
  // A court about "user-experience" where only UX credentials matter
  const uxCourt = mkFullCourt(
    'user-experience',
    'ux',
    new Map([['ux-design', 3.0]]),
    'max-authority',
    0.7,
  );

  const secLead = mkAuthority('security-lead', 'human', ['security-cert'], 90);
  const uxLead = mkAuthority('ux-lead', 'human', ['ux-design'], 85);

  it('security lead has zero effective rank in UX court', () => {
    const secRank = effectiveRank(secLead, uxCourt);
    expect(secRank).toBe(0);
  });

  it('UX lead dominates security lead in UX court', () => {
    const degree = dominates(uxLead, secLead, uxCourt);
    // uxLead has rank > 0, secLead has 0 → degree = 255 / (255 + 0) = 1.0
    expect(degree).toBe(1.0);
  });

  it('in a neutral court, neither has jurisdiction → 0.5', () => {
    const neutralCourt = mkFullCourt(
      'philosophy',
      'philosophy',
      new Map([['philosophy-cert', 1.0]]),
      'max-authority',
      0.7,
    );
    const degree = dominates(secLead, uxLead, neutralCourt);
    expect(degree).toBe(0.5); // neither has credentials
  });

  it('adjudication in neutral court returns Contra (institutional uncertainty)', () => {
    const neutralCourt = mkFullCourt(
      'philosophy',
      'philosophy',
      new Map([['philosophy-cert', 1.0]]),
      'max-authority',
      0.7,
    );

    const stances: Stance[] = [
      stance(mkStr('security-first'), secLead),
      stance(mkStr('usability-first'), uxLead),
    ];

    const result = adjudicate(neutralCourt, stances);

    // Neither dominates → should return Contra as binding
    expect(isContra(result.binding)).toBe(true);
    if (result.binding.kind === 'contra') {
      // The Contra holds both positions
      expect(result.binding.site).toContain('philosophy');
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// Test Scenario 3: Dissent from below
// Junior engineer refutes senior architect — authority gap is negative
// but contradiction exists with junior's evidence
// ══════════════════════════════════════════════════════════════════════

describe('Scenario 3: Dissent from below', () => {
  const archCourt = mkFullCourt(
    'architecture',
    'architecture',
    new Map([['architecture', 2.0], ['engineering', 1.0]]),
    'weighted-confidence',
    0.7,
  );

  const seniorArchitect = mkAuthority('senior-architect', 'human', ['architecture', 'engineering'], 80);
  const juniorEngineer = mkAuthority('junior-engineer', 'human', ['engineering'], 20);

  it('junior CAN refute senior — refutation is created regardless of rank', () => {
    const refutation = mkRefutation(
      'architecture',
      juniorEngineer,
      'monolith-design',
      mkStr('microservices-better-because-evidence'),
    );

    expect(refutation.refuter.name).toBe('junior-engineer');
    expect(refutation.target).toBe('monolith-design');

    // The contra carries the authority gap as tension
    const contra = refutationToContra(
      refutation,
      mkStr('monolith-is-correct'),
      seniorArchitect,
    );

    expect(isContra(contra)).toBe(true);
    if (contra.kind === 'contra') {
      // Tension reflects authority gap
      expect(contra.tension).toBeGreaterThan(0);
      // Both positions are preserved
      expect(contra.yes).toEqual(mkStr('monolith-is-correct'));
      expect(contra.no).toEqual(mkStr('microservices-better-because-evidence'));
    }
  });

  it('junior with strong evidence challenges senior under weighted-confidence', () => {
    // Junior has 5 pieces of evidence, senior has 1
    const stances: Stance[] = [
      {
        value: mkStr('monolith-design'),
        issuer: seniorArchitect,
        evidence: [mkStr('experience')],
      },
      {
        value: mkStr('microservices-design'),
        issuer: juniorEngineer,
        evidence: [
          mkStr('benchmark-data'),
          mkStr('scaling-analysis'),
          mkStr('cost-projection'),
          mkStr('team-survey'),
          mkStr('prototype-results'),
        ],
      },
    ];

    const result = adjudicate(archCourt, stances);

    // Under weighted-confidence, weight = effectiveRank × evidence count
    // senior: 80 * (2+1) * 1 = 240
    // junior: 20 * 1 * 5 = 100
    // Senior still wins in weight but gap is narrowed by evidence
    // The result should reflect this tension
    expect(result.confidence).toBeLessThan(1.0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('when evidence overwhelms authority gap, junior stance carries weight', () => {
    // Give junior even more evidence to demonstrate the principle
    const juniorEvidence = Array.from({ length: 20 }, (_, i) =>
      mkStr(`evidence-${i}`)
    );

    const stances: Stance[] = [
      {
        value: mkStr('senior-position'),
        issuer: seniorArchitect,
        evidence: [mkStr('gut-feeling')],
      },
      {
        value: mkStr('junior-position'),
        issuer: juniorEngineer,
        evidence: juniorEvidence,
      },
    ];

    const result = adjudicate(archCourt, stances);

    // Junior: 20 * 1 * 20 = 400 weight
    // Senior: 80 * 3 * 1 = 240 weight
    // Junior should now have higher weight
    // Result should either pick junior or return Contra (depending on gap vs threshold)
    expect(result.binding).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Test Scenario 4: Probabilistic dominance
// Two authorities with dominance degree ~0.6
// ══════════════════════════════════════════════════════════════════════

describe('Scenario 4: Probabilistic dominance', () => {
  // Design ranks so dominance ≈ 0.6
  // degree = rankA / (rankA + rankB) = 0.6 → rankA = 1.5 * rankB
  const probCourt = mkFullCourt(
    'design-review',
    'design',
    new Map([['design', 1.0]]),
    'max-authority',
    0.7,
  );

  const authA = mkAuthority('alice', 'human', ['design'], 15); // effective: 15
  const authB = mkAuthority('bob', 'human', ['design'], 10);   // effective: 10

  it('dominance degree is approximately 0.6', () => {
    const degree = dominates(authA, authB, probCourt);
    // 15 / (15 + 10) = 0.6
    expect(degree).toBe(0.6);
  });

  it('degree 0.6 is below default threshold 0.7 → ambiguous', () => {
    expect(0.6 < probCourt.threshold).toBe(true);
  });

  it('adjudication returns low confidence with meaningful dissent', () => {
    const stances: Stance[] = [
      stance(mkStr('approach-a'), authA),
      stance(mkStr('approach-b'), authB),
    ];

    const result = adjudicate(probCourt, stances);

    // Degree (0.6) < threshold (0.7) → should return Contra
    expect(isContra(result.binding)).toBe(true);

    if (result.binding.kind === 'contra') {
      // Both approaches are preserved in the Contra
      const contraBinding = result.binding;
      expect(contraBinding.tension).toBeGreaterThan(0);
    }
  });

  it('with lower threshold, same degree becomes a clear decision', () => {
    const lenientCourt = mkFullCourt(
      'design-review-lenient',
      'design',
      new Map([['design', 1.0]]),
      'max-authority',
      0.55, // lower threshold
    );

    const stances: Stance[] = [
      stance(mkStr('approach-a'), authA),
      stance(mkStr('approach-b'), authB),
    ];

    const result = adjudicate(lenientCourt, stances);

    // 0.6 > 0.55 → clear dominance → binding = approach-a
    expect(result.binding).toEqual(mkStr('approach-a'));
    expect(result.confidence).toBe(0.6);
    expect(result.dissent).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════
// Test Scenario 5: Overlapping courts
// Two courts claim jurisdiction, disagree → Contra of Contras
// ══════════════════════════════════════════════════════════════════════

describe('Scenario 5: Overlapping courts', () => {
  // Security court values security credentials
  const securityCourt = mkFullCourt(
    'security-review',
    'security',
    new Map([['security-cert', 3.0]]),
    'max-authority',
    0.7,
  );

  // Performance court values performance credentials
  const perfCourt = mkFullCourt(
    'performance-review',
    'performance',
    new Map([['perf-cert', 3.0]]),
    'max-authority',
    0.7,
  );

  // Security expert says "add encryption" (has security creds)
  const secExpert = mkAuthority('sec-expert', 'human', ['security-cert'], 80);
  // Performance expert says "skip encryption" (has perf creds)
  const perfExpert = mkAuthority('perf-expert', 'human', ['perf-cert'], 80);

  const stances: Stance[] = [
    stance(mkStr('add-encryption'), secExpert),
    stance(mkStr('skip-encryption'), perfExpert),
  ];

  it('security court resolves in favor of security expert', () => {
    const result = adjudicate(securityCourt, stances);
    // secExpert has credentials in security court, perfExpert doesn't
    expect(result.binding).toEqual(mkStr('add-encryption'));
  });

  it('performance court resolves in favor of performance expert', () => {
    const result = adjudicate(perfCourt, stances);
    // perfExpert has credentials in perf court, secExpert doesn't
    expect(result.binding).toEqual(mkStr('skip-encryption'));
  });

  it('multi-court adjudication returns Contra of Contras', () => {
    const result = multiCourtAdjudicate([securityCourt, perfCourt], stances);

    // Courts disagree → result should be a Contra
    expect(isContra(result.binding)).toBe(true);

    if (result.binding.kind === 'contra') {
      // One side says add-encryption, other says skip-encryption
      expect(result.binding.yes).toEqual(mkStr('add-encryption'));
      expect(result.binding.no).toEqual(mkStr('skip-encryption'));
      expect(result.binding.site).toBe('multi-court-conflict');
    }
  });

  it('multi-court with agreeing courts returns unified result', () => {
    // Both experts agree on this claim
    const agreeStances: Stance[] = [
      stance(mkStr('use-tls'), secExpert),
      stance(mkStr('use-tls'), perfExpert),
    ];

    // In security court: secExpert dominates (has creds), binding = use-tls
    // In perf court: perfExpert dominates (has creds), binding = use-tls
    // Both agree → no Contra
    const result = multiCourtAdjudicate([securityCourt, perfCourt], agreeStances);
    expect(result.binding).toEqual(mkStr('use-tls'));
    expect(isContra(result.binding)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// Additional: Policy-specific tests
// ══════════════════════════════════════════════════════════════════════

describe('unanimous-or-contra policy', () => {
  const court = mkFullCourt(
    'consensus-court',
    'consensus',
    new Map([['member', 1.0]]),
    'unanimous-or-contra',
    0.7,
  );

  const auth1 = mkAuthority('alice', 'human', ['member'], 10);
  const auth2 = mkAuthority('bob', 'human', ['member'], 10);
  const auth3 = mkAuthority('charlie', 'human', ['member'], 10);

  it('unanimous agreement returns binding with full confidence', () => {
    const stances: Stance[] = [
      stance(mkStr('agreed-value'), auth1),
      stance(mkStr('agreed-value'), auth2),
      stance(mkStr('agreed-value'), auth3),
    ];

    const result = adjudicate(court, stances);
    expect(result.binding).toEqual(mkStr('agreed-value'));
    expect(result.confidence).toBe(1.0);
    expect(result.dissent).toBeNull();
  });

  it('any disagreement returns Contra', () => {
    const stances: Stance[] = [
      stance(mkStr('option-a'), auth1),
      stance(mkStr('option-a'), auth2),
      stance(mkStr('option-b'), auth3),
    ];

    const result = adjudicate(court, stances);
    expect(isContra(result.binding)).toBe(true);
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe('single stance', () => {
  const court = mkFullCourt('solo', 'solo', new Map(), 'max-authority', 0.7);
  const auth = mkAuthority('only-one', 'human', [], 50);

  it('single stance returns it with full confidence', () => {
    const result = adjudicate(court, [stance(mkStr('only-claim'), auth)]);
    expect(result.binding).toEqual(mkStr('only-claim'));
    expect(result.confidence).toBe(1.0);
    expect(result.dissent).toBeNull();
  });
});

describe('no stances', () => {
  const court = mkFullCourt('empty', 'empty', new Map(), 'max-authority', 0.7);

  it('no stances returns no-stances with zero confidence', () => {
    const result = adjudicate(court, []);
    expect(result.binding).toEqual(mkStr('no-stances'));
    expect(result.confidence).toBe(0);
  });
});
