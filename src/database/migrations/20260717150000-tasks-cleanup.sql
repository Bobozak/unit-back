-- Tasks cleanup: drop legacy columns, convert dates to timestamptz, add complexity/overdueReason

ALTER TABLE tasks DROP COLUMN IF EXISTS type;
ALTER TABLE tasks DROP COLUMN IF EXISTS pinned;
ALTER TABLE tasks DROP COLUMN IF EXISTS geolocation;
ALTER TABLE tasks DROP COLUMN IF EXISTS duration;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS complexity smallint;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "overdueReason" varchar(200);

UPDATE tasks SET complexity = 1 WHERE complexity IS NULL;
ALTER TABLE tasks ALTER COLUMN complexity SET NOT NULL;

ALTER TABLE tasks
  ALTER COLUMN "createDate" TYPE timestamptz
  USING NULLIF("createDate", '')::timestamptz;

ALTER TABLE tasks
  ALTER COLUMN "startDate" TYPE timestamptz
  USING NULLIF("startDate", '')::timestamptz;

ALTER TABLE tasks
  ALTER COLUMN deadline TYPE timestamptz
  USING NULLIF(deadline, '')::timestamptz;

ALTER TABLE tasks
  ALTER COLUMN "completeDate" TYPE timestamptz
  USING NULLIF("completeDate", '')::timestamptz;

ALTER TABLE tasks ALTER COLUMN deadline SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tasks_type_enum') THEN
    DROP TYPE tasks_type_enum;
  END IF;
END $$;
