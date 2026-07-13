ALTER TABLE teacher_attendance_records
  ADD COLUMN IF NOT EXISTS hourly_rate_snapshot NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS payable_minutes INT;

ALTER TABLE teacher_attendance_records
  DROP CONSTRAINT IF EXISTS teacher_attendance_payroll_check;

ALTER TABLE teacher_attendance_records
  ADD CONSTRAINT teacher_attendance_payroll_check CHECK (
    (hourly_rate_snapshot IS NULL OR hourly_rate_snapshot >= 0)
    AND (payable_minutes IS NULL OR payable_minutes BETWEEN 0 AND 720)
    AND (check_out_at IS NULL OR check_out_at >= check_in_at)
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM teacher_attendance_records
    WHERE class_session_id IS NOT NULL
    GROUP BY teacher_id, class_session_id
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_attendance_session
      ON teacher_attendance_records(teacher_id, class_session_id)
      WHERE class_session_id IS NOT NULL;
  END IF;
END $$;
