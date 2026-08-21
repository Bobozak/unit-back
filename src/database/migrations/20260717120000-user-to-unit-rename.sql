-- User → Unit domain rename (idempotent)

-- 1. Rename tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'units'
  ) THEN
    ALTER TABLE users RENAME TO units;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_balance'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'unit_balance'
  ) THEN
    ALTER TABLE user_balance RENAME TO unit_balance;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users_to_reasons'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'units_to_reasons'
  ) THEN
    ALTER TABLE users_to_reasons RENAME TO units_to_reasons;
  END IF;
END $$;

-- 2. Rename username → unitname on units
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'username'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'units' AND column_name = 'unitname'
  ) THEN
    ALTER TABLE units RENAME COLUMN username TO unitname;
  END IF;
END $$;

-- 3. Rename userId → unitId on related tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'unitId'
  ) THEN
    ALTER TABLE tasks RENAME COLUMN "userId" TO "unitId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session' AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session' AND column_name = 'unitId'
  ) THEN
    ALTER TABLE session RENAME COLUMN "userId" TO "unitId";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unit_balance' AND column_name = 'userId'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unit_balance' AND column_name = 'unitId'
  ) THEN
    ALTER TABLE unit_balance RENAME COLUMN "userId" TO "unitId";
  END IF;
END $$;

-- 4. Rename unique constraint on unitname
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_unique'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'units_unitname_unique'
  ) THEN
    ALTER TABLE units RENAME CONSTRAINT users_username_unique TO units_unitname_unique;
  END IF;
END $$;
