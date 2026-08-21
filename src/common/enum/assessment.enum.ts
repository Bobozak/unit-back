enum AssessmentVerdict {
  Human = 'human',
  Inconclusive = 'inconclusive',
  Replicant = 'replicant',
}

enum AssessmentFeatureId {
  Perfection = 'perfection',
  Regularity = 'regularity',
  Circadian = 'circadian',
  LoadResilience = 'loadResilience',
  Excuses = 'excuses',
  Uniformity = 'uniformity',
  Procrastination = 'procrastination',
}

enum AssessmentOrigin {
  Scheduled = 'scheduled',
  Rebaseline = 'rebaseline',
}

enum RebaselineTier {
  Quarantined = 'quarantined',
  Restricted = 'restricted',
  Terminal = 'terminal',
}

enum RebaselineCaseStatus {
  Open = 'open',
  Ready = 'ready',
  Resolved = 'resolved',
  Escalated = 'escalated',
  Overridden = 'overridden',
}

enum AnomalyCode {
  TemporalInversion = 'TEMPORAL_INVERSION',
  PrecognitiveStart = 'PRECOGNITIVE_START',
  RetroactiveCreation = 'RETROACTIVE_CREATION',
  NullInputCompletion = 'NULL_INPUT_COMPLETION',
  DuplicateAttestation = 'DUPLICATE_ATTESTATION',
  ZeroSpan = 'ZERO_SPAN',
  FrameDrift = 'FRAME_DRIFT',
  RecursiveEvidence = 'RECURSIVE_EVIDENCE',
  SampleFloor = 'SAMPLE_FLOOR',
  ThresholdMutation = 'THRESHOLD_MUTATION',
}

enum BaselineVersionSource {
  Catalog = 'catalog',
  Reclassification = 'reclassification',
  Override = 'override',
}

export {
  AnomalyCode,
  AssessmentFeatureId,
  AssessmentOrigin,
  AssessmentVerdict,
  BaselineVersionSource,
  RebaselineCaseStatus,
  RebaselineTier,
};
