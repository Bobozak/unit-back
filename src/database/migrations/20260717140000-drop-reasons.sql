-- Drop reasons domain (idempotent)
DROP TABLE IF EXISTS units_to_reasons CASCADE;
DROP TABLE IF EXISTS tasks_to_reasons CASCADE;
DROP TABLE IF EXISTS reasons CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reasons_reason_enum') THEN
    DROP TYPE reasons_reason_enum;
  END IF;
END $$;
