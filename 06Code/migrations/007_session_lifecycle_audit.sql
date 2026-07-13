ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS attendance_finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_finalized_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id);

ALTER TABLE class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_lifecycle_check;

UPDATE class_sessions
SET cancellation_reason = COALESCE(cancellation_reason, 'Legacy cancellation migrated without a recorded reason.'),
    cancelled_at = COALESCE(cancelled_at, ends_at, now())
WHERE status = 'cancelled';

ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_lifecycle_check CHECK (
    (status <> 'cancelled' OR (
      cancellation_reason IS NOT NULL
      AND length(trim(cancellation_reason)) >= 5
      AND cancelled_at IS NOT NULL
    ))
  );

CREATE INDEX IF NOT EXISTS idx_class_sessions_teacher_conflict
  ON class_sessions(starts_at, ends_at)
  WHERE status <> 'cancelled';
