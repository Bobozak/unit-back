-- Weekly unit assessment reports + block flags on units

DO $$ BEGIN
  CREATE TYPE assessment_verdict AS ENUM ('human', 'inconclusive', 'replicant');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS unit_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unitId" uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  "periodStart" timestamptz NOT NULL,
  "periodEnd" timestamptz NOT NULL,
  "computedAt" timestamptz NOT NULL DEFAULT now(),
  "sampleSize" int NOT NULL,
  features jsonb NOT NULL,
  metrics jsonb NOT NULL,
  score numeric(5,4) NOT NULL,
  "replicantProbability" numeric(5,4) NOT NULL,
  verdict assessment_verdict NOT NULL,
  "acknowledgedAt" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_unit_assessments_unitId_periodEnd"
  ON unit_assessments ("unitId", "periodEnd");

CREATE INDEX IF NOT EXISTS "IDX_unit_assessments_unitId_computedAt"
  ON unit_assessments ("unitId", "computedAt" DESC);

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS "isBlocked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "blockedAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "blockingAssessmentId" uuid,
  ADD COLUMN IF NOT EXISTS "lastAssessmentAt" timestamptz;
