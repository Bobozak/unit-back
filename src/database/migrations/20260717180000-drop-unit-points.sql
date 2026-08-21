-- Drop points column from units (idempotent)
ALTER TABLE units DROP COLUMN IF EXISTS points;
