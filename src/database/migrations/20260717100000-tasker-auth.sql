-- Tasker auth migration (TypeORM camelCase column names)
-- Run once before starting the app after Tasker auth deploy.

-- 1. password -> passphrase (rename, do not add new column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passphrase'
  ) THEN
    ALTER TABLE users RENAME COLUMN password TO passphrase;
  END IF;
END $$;

-- 2. If both columns exist (failed sync), copy and drop password
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'password'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'passphrase'
  ) THEN
    UPDATE users SET passphrase = password WHERE passphrase IS NULL AND password IS NOT NULL;
    ALTER TABLE users DROP COLUMN password;
  END IF;
END $$;

-- 3. New verification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS "verificationCode" varchar(16);
ALTER TABLE users ADD COLUMN IF NOT EXISTS "isVerified" boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "verifiedAt" varchar;

-- 4. Legacy users: mark verified (created before Tasker flow)
UPDATE users SET "isVerified" = true WHERE "isVerified" IS NULL OR "isVerified" = false;

-- 5. Remove old auth columns
ALTER TABLE users DROP COLUMN IF EXISTS email;
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS provider;

-- 6. passphrase NOT NULL (only if no nulls remain)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE passphrase IS NULL) THEN
    ALTER TABLE users ALTER COLUMN passphrase SET NOT NULL;
  END IF;
END $$;

-- 7. username unique
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;
