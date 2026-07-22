ALTER TABLE enrollment_requests
  ADD COLUMN IF NOT EXISTS status_notes TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_student_id UUID REFERENCES students(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE enrollment_requests
  DROP CONSTRAINT IF EXISTS enrollment_requests_status_check;

ALTER TABLE enrollment_requests
  ADD CONSTRAINT enrollment_requests_status_check CHECK (
    status IN ('pending', 'contacted', 'trial_scheduled', 'enrolled', 'lost')
  );

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_branch_status
  ON enrollment_requests(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_enrollment_requests_follow_up
  ON enrollment_requests(follow_up_at)
  WHERE status IN ('contacted', 'trial_scheduled');

CREATE UNIQUE INDEX IF NOT EXISTS uq_enrollment_requests_converted_student
  ON enrollment_requests(converted_student_id)
  WHERE converted_student_id IS NOT NULL;
