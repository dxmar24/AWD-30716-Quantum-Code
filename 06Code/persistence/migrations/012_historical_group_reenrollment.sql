ALTER TABLE class_group_enrollments
  DROP CONSTRAINT IF EXISTS class_group_enrollments_student_group_unique;

ALTER TABLE class_group_enrollments
  DROP CONSTRAINT IF EXISTS class_group_enrollments_student_id_class_group_id_key;

DROP INDEX IF EXISTS class_group_enrollments_student_id_class_group_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_class_group_enrollments_one_current_episode
  ON class_group_enrollments(student_id, class_group_id)
  WHERE status IN ('active', 'trial', 'waitlisted', 'frozen');
