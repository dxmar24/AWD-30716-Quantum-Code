ALTER TABLE class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_attendance_finalization_coherence_check;

ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_attendance_finalization_coherence_check CHECK (
    (
      attendance_state = 'finalized'
      AND status = 'completed'
      AND attendance_finalized_at IS NOT NULL
      AND attendance_finalized_by IS NOT NULL
    )
    OR
    (
      attendance_state = 'draft'
      AND status <> 'completed'
      AND attendance_finalized_at IS NULL
      AND attendance_finalized_by IS NULL
    )
  ) NOT VALID;

ALTER TABLE scholarship_evaluations
  ADD COLUMN IF NOT EXISTS evaluation_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evaluation_to TIMESTAMPTZ;

ALTER TABLE level_promotion_evaluations
  ADD COLUMN IF NOT EXISTS evaluation_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS evaluation_to TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_scholarship_evaluations_one_approval
  ON scholarship_evaluations(student_id, evaluation_from, evaluation_to)
  WHERE approved IS TRUE
    AND student_id IS NOT NULL
    AND evaluation_from IS NOT NULL
    AND evaluation_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_level_promotions_one_approved_transition
  ON level_promotion_evaluations(student_id, from_level, to_level)
  WHERE approved IS TRUE AND student_id IS NOT NULL;
