ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseChangeCode" varchar(16);
ALTER TABLE units ADD COLUMN IF NOT EXISTS "passphraseChangeCodeExpiresAt" timestamptz;
