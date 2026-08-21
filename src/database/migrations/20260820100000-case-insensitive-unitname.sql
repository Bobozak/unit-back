-- Case-insensitive uniqueness for unitname (Bobozak / bobozak / BoBoZak).
-- Stored casing is preserved; uniqueness is on LOWER(unitname).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM units
    GROUP BY LOWER(unitname)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot create case-insensitive unitname index: duplicate unitnames exist that differ only by case';
  END IF;
END $$;

ALTER TABLE units DROP CONSTRAINT IF EXISTS units_unitname_unique;
ALTER TABLE units DROP CONSTRAINT IF EXISTS users_username_unique;

DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT i.relname AS index_name
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'units'
      AND a.attname = 'unitname'
      AND x.indisunique
      AND i.relname <> 'units_unitname_lower_unique'
      AND array_length(x.indkey, 1) = 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.index_name);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS units_unitname_lower_unique
  ON units (LOWER(unitname));
