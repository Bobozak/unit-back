-- Final investigation lock after four replicant assessment strikes

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS "replicantStrikeCount" int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "finalInvestigationAt" timestamptz;
