ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS automation_key TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_automation_key ON tasks(automation_key) WHERE automation_key IS NOT NULL;

ALTER TABLE patients ADD COLUMN IF NOT EXISTS aftercare_started_at TIMESTAMPTZ;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS aftercare_checkup_months INTEGER DEFAULT 6;
