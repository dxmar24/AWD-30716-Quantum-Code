CREATE UNIQUE INDEX IF NOT EXISTS idx_students_user_id_unique ON students(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_user_id_unique ON teachers(user_id) WHERE user_id IS NOT NULL;
