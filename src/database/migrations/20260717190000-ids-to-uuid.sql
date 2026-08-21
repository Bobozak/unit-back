-- Destructive: wipes all units/tasks/sessions. All JWTs invalidated.
-- Dev: run this migration, then restart app (synchronize: true recreates uuid schema).
-- Prod: run before deploy with updated entities.

DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS units CASCADE;
