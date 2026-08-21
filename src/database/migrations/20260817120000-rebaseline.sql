-- Rebaseline diagnostics: assessment revisions, unit memory, cases, claims, baseline versions

DO $$ BEGIN
  CREATE TYPE assessment_origin AS ENUM ('scheduled', 'rebaseline');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE rebaseline_tier AS ENUM ('quarantined', 'restricted', 'terminal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE rebaseline_case_status AS ENUM (
    'open',
    'ready',
    'resolved',
    'escalated',
    'overridden'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE anomaly_code AS ENUM (
    'TEMPORAL_INVERSION',
    'PRECOGNITIVE_START',
    'RETROACTIVE_CREATION',
    'NULL_INPUT_COMPLETION',
    'DUPLICATE_ATTESTATION',
    'ZERO_SPAN',
    'FRAME_DRIFT',
    'RECURSIVE_EVIDENCE',
    'SAMPLE_FLOOR',
    'THRESHOLD_MUTATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE baseline_version_source AS ENUM (
    'catalog',
    'reclassification',
    'override'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE unit_assessments
  ADD COLUMN IF NOT EXISTS revision int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origin assessment_origin NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS "disqualifiedFeatures" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "supersedesAssessmentId" uuid;

DROP INDEX IF EXISTS "UQ_unit_assessments_unitId_periodEnd";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_unit_assessments_unitId_periodEnd_revision"
  ON unit_assessments ("unitId", "periodEnd", revision);

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS "reclassificationCount" int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "baselineVersion" varchar NOT NULL DEFAULT 'v3.7.14',
  ADD COLUMN IF NOT EXISTS "disqualifiedFeatures" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "manualOverrideAt" timestamptz;

CREATE TABLE IF NOT EXISTS rebaseline_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unitId" uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  "blockingAssessmentId" uuid NOT NULL REFERENCES unit_assessments(id) ON DELETE CASCADE,
  "resultingAssessmentId" uuid REFERENCES unit_assessments(id) ON DELETE SET NULL,
  tier rebaseline_tier NOT NULL,
  integrity numeric(5,4) NOT NULL DEFAULT 1,
  "requiredClaims" int NOT NULL,
  "acceptedCount" int NOT NULL DEFAULT 0,
  "rejectedCount" int NOT NULL DEFAULT 0,
  "maxRejected" int NOT NULL,
  noise numeric(5,4) NOT NULL DEFAULT 0,
  status rebaseline_case_status NOT NULL DEFAULT 'open',
  "baselineVersionAtOpen" varchar NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_rebaseline_cases_unitId_createdAt"
  ON rebaseline_cases ("unitId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS rebaseline_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" uuid NOT NULL REFERENCES rebaseline_cases(id) ON DELETE CASCADE,
  "anomalyCode" anomaly_code NOT NULL,
  "targetFeature" varchar,
  "evidenceRefs" jsonb NOT NULL,
  accepted boolean NOT NULL,
  "filedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_rebaseline_claims_caseId_filedAt"
  ON rebaseline_claims ("caseId", "filedAt" DESC);

CREATE TABLE IF NOT EXISTS baseline_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unitId" uuid REFERENCES units(id) ON DELETE CASCADE,
  version varchar NOT NULL,
  "replicantThreshold" numeric(5,4) NOT NULL,
  source baseline_version_source NOT NULL,
  "recordedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_baseline_versions_unitId_recordedAt"
  ON baseline_versions ("unitId", "recordedAt");

INSERT INTO baseline_versions (id, "unitId", version, "replicantThreshold", source, "recordedAt")
SELECT gen_random_uuid(), NULL, seed.version, seed.threshold, 'catalog', seed.recorded
FROM (
  VALUES
    ('v3.7.11', 0.7200, TIMESTAMPTZ '2024-03-11 00:00:00+00'),
    ('v3.7.12', 0.6800, TIMESTAMPTZ '2025-01-08 00:00:00+00'),
    ('v3.7.14', 0.6500, TIMESTAMPTZ '2026-06-02 00:00:00+00')
) AS seed(version, threshold, recorded)
WHERE NOT EXISTS (
  SELECT 1 FROM baseline_versions
  WHERE "unitId" IS NULL AND version = seed.version
);
