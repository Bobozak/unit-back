ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseResetRound1Code" varchar(16);
ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseResetRound1ExpiresAt" timestamptz;
ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseResetRound1VerifiedAt" timestamptz;
ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseResetRound2Code" varchar(16);
ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseResetRound2ExpiresAt" timestamptz;
