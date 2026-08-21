-- Notes table: task notes with cascade delete

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text varchar(1500) NOT NULL,
  "taskId" uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_notes_taskId" ON notes ("taskId");
