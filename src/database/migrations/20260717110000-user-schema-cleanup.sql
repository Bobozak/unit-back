-- User schema cleanup: remove preference fields, convert dates to timestamptz

ALTER TABLE users DROP COLUMN IF EXISTS language;
ALTER TABLE users DROP COLUMN IF EXISTS "isActive";
ALTER TABLE users DROP COLUMN IF EXISTS "memeReaction";
ALTER TABLE users DROP COLUMN IF EXISTS "isAutoGenerateSubTasks";
ALTER TABLE users DROP COLUMN IF EXISTS "taskMinutes";
ALTER TABLE users DROP COLUMN IF EXISTS "accentColor";
ALTER TABLE users DROP COLUMN IF EXISTS theme;

ALTER TABLE users
  ALTER COLUMN "createdAt" TYPE timestamptz USING "createdAt"::timestamptz,
  ALTER COLUMN "updatedAt" TYPE timestamptz USING "updatedAt"::timestamptz,
  ALTER COLUMN "deletedAt" TYPE timestamptz USING "deletedAt"::timestamptz;

ALTER TABLE users
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" SET DEFAULT now();

-- Backfill legacy rows with null timestamps before NOT NULL constraint
UPDATE users SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE users
SET "updatedAt" = COALESCE("updatedAt", "createdAt", now())
WHERE "updatedAt" IS NULL;

ALTER TABLE users
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "updatedAt" SET NOT NULL;
