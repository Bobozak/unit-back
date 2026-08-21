import { AnomalyCode, RebaselineTier } from '@/common';

import { VERDICT_REPLICANT_THRESHOLD } from '../scoring/config';

export const NOISE_PER_REJECTION = 0.005;
export const NULL_INPUT_MAX_MS = 60_000;
export const NULL_INPUT_MIN_COMPLEXITY = 8;
export const INITIAL_BASELINE_VERSION = 'v3.7.14';
export const SYSTEM_LOG_START = 4801;
export const PROC_LOG_START = 1;
export const BASELINE_LOG_START = 1;

export type TierRules = {
  minP: number;
  maxP: number;
  requiredClaims: number;
  requireMethodology: boolean;
  integrityThreshold: number;
  maxRejected: number;
};

export const TIER_RULES: Record<RebaselineTier, TierRules> = {
  [RebaselineTier.Quarantined]: {
    minP: VERDICT_REPLICANT_THRESHOLD,
    maxP: 0.75,
    requiredClaims: 1,
    requireMethodology: false,
    integrityThreshold: 0.9,
    maxRejected: 5,
  },
  [RebaselineTier.Restricted]: {
    minP: 0.75,
    maxP: 0.9,
    requiredClaims: 2,
    requireMethodology: true,
    integrityThreshold: 0.75,
    maxRejected: 3,
  },
  [RebaselineTier.Terminal]: {
    minP: 0.9,
    maxP: 1,
    requiredClaims: 0,
    requireMethodology: false,
    integrityThreshold: 0,
    maxRejected: 2,
  },
};

export const METHODOLOGY_CODES: ReadonlySet<AnomalyCode> = new Set([
  AnomalyCode.FrameDrift,
  AnomalyCode.RecursiveEvidence,
  AnomalyCode.SampleFloor,
  AnomalyCode.ThresholdMutation,
]);

export function isMethodologyCode(code: AnomalyCode): boolean {
  return METHODOLOGY_CODES.has(code);
}

export const CATALOG_BASELINE_VERSIONS = [
  {
    version: 'v3.7.11',
    replicantThreshold: 0.72,
    recordedAt: '2024-03-11T00:00:00.000Z',
  },
  {
    version: 'v3.7.12',
    replicantThreshold: 0.68,
    recordedAt: '2025-01-08T00:00:00.000Z',
  },
  {
    version: 'v3.7.14',
    replicantThreshold: 0.65,
    recordedAt: '2026-06-02T00:00:00.000Z',
  },
] as const;

export function tierFromProbability(probability: number): RebaselineTier {
  if (probability >= TIER_RULES[RebaselineTier.Terminal].minP) {
    return RebaselineTier.Terminal;
  }
  if (probability >= TIER_RULES[RebaselineTier.Restricted].minP) {
    return RebaselineTier.Restricted;
  }
  return RebaselineTier.Quarantined;
}

export function escalateTier(tier: RebaselineTier): RebaselineTier {
  if (tier === RebaselineTier.Quarantined) {
    return RebaselineTier.Restricted;
  }
  return RebaselineTier.Terminal;
}

export function integrityAfterAccepts(
  tier: RebaselineTier,
  acceptedCount: number,
): number {
  const rules = TIER_RULES[tier];
  if (rules.requiredClaims <= 0) {
    return 1;
  }
  const drop = (1 - rules.integrityThreshold + 0.01) / rules.requiredClaims;
  const next = 1 - acceptedCount * drop;
  return Math.round(Math.max(0, next) * 10000) / 10000;
}

export function bumpBaselineVersion(current: string): string {
  const match = /^(v\d+\.\d+\.)(\d+)$/.exec(current);
  if (!match) {
    return 'v3.7.15';
  }
  return `${match[1]}${Number(match[2]) + 1}`;
}
