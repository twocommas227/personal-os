ALTER TABLE tasks ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'personal'
  CHECK (context IN ('personal', 'kritamorn', 'two_commas'));

CREATE INDEX IF NOT EXISTS tasks_user_context ON tasks (user_id, context);
