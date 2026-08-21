-- Rate-limit logged-in passphrase change challenges: 3 per 60 minutes

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS "passphraseChangeChallengeCount" int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "passphraseChangeChallengeWindowStartedAt" timestamptz;
