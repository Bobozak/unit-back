-- Security question / hashed answer + brute-force lockout for passphrase change/reset

TRUNCATE TABLE units CASCADE;

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS "securityQuestion" varchar(200) NOT NULL,
  ADD COLUMN IF NOT EXISTS "securityAnswerHash" varchar NOT NULL,
  ADD COLUMN IF NOT EXISTS "securityAnswerFailedAttempts" int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "securityAnswerLockedUntil" timestamptz;
