UPDATE branches SET active = TRUE WHERE active IS NULL;
UPDATE branches SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE branches ALTER COLUMN active SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;

UPDATE users SET must_change_password = TRUE WHERE must_change_password IS NULL;
UPDATE users SET active = TRUE WHERE active IS NULL;
UPDATE users SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE users
  ALTER COLUMN must_change_password SET NOT NULL,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

UPDATE user_branch_access SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE user_branch_access ALTER COLUMN created_at SET NOT NULL;

UPDATE students SET level = 'B1' WHERE level IS NULL;
UPDATE students SET active = TRUE WHERE active IS NULL;
ALTER TABLE students ALTER COLUMN level SET NOT NULL, ALTER COLUMN active SET NOT NULL;

UPDATE teachers SET active = TRUE WHERE active IS NULL;
ALTER TABLE teachers ALTER COLUMN active SET NOT NULL;

UPDATE class_groups SET active = TRUE WHERE active IS NULL;
ALTER TABLE class_groups ALTER COLUMN active SET NOT NULL;

UPDATE student_attendance_records SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE student_attendance_records ALTER COLUMN created_at SET NOT NULL;

UPDATE scholarship_rules SET active = TRUE WHERE active IS NULL;
ALTER TABLE scholarship_rules ALTER COLUMN active SET NOT NULL;

UPDATE scholarship_evaluations SET approved = FALSE WHERE approved IS NULL;
ALTER TABLE scholarship_evaluations ALTER COLUMN approved SET NOT NULL;

UPDATE level_promotion_evaluations SET approved = FALSE WHERE approved IS NULL;
ALTER TABLE level_promotion_evaluations ALTER COLUMN approved SET NOT NULL;

UPDATE enrollment_requests SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE enrollment_requests ALTER COLUMN created_at SET NOT NULL;

UPDATE sessions SET revoked = TRUE WHERE revoked IS NULL;
ALTER TABLE sessions ALTER COLUMN revoked SET NOT NULL;

UPDATE audit_logs SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE audit_logs ALTER COLUMN created_at SET NOT NULL;

UPDATE academy_events SET active = TRUE WHERE active IS NULL;
UPDATE academy_events SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE academy_events ALTER COLUMN active SET NOT NULL, ALTER COLUMN created_at SET NOT NULL;

UPDATE student_payments SET created_at = now() WHERE created_at IS NULL;
ALTER TABLE student_payments ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE class_sessions
  DROP CONSTRAINT IF EXISTS class_sessions_status_check;
ALTER TABLE class_sessions
  ADD CONSTRAINT class_sessions_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled')) NOT VALID;

ALTER TABLE teacher_attendance_records
  DROP CONSTRAINT IF EXISTS teacher_attendance_requires_session_check;
ALTER TABLE teacher_attendance_records
  ADD CONSTRAINT teacher_attendance_requires_session_check CHECK (class_session_id IS NOT NULL) NOT VALID;

ALTER TABLE student_payments
  DROP CONSTRAINT IF EXISTS student_payments_period_check;
ALTER TABLE student_payments
  ADD CONSTRAINT student_payments_period_check CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$') NOT VALID;

INSERT INTO roles(name) VALUES
  ('Visitor'), ('Student'), ('Teacher'), ('BranchDirector'), ('GeneralDirector'), ('Admin')
ON CONFLICT DO NOTHING;

INSERT INTO permissions(code, description) VALUES
  ('attendance.record', 'Record and finalize student attendance'),
  ('teacher.check', 'Teacher check-in and check-out'),
  ('academic.manage', 'Manage academic profiles and groups'),
  ('enrollment.manage', 'Manage class group enrollments and capacity'),
  ('schedule.manage', 'Manage sessions and cancellations'),
  ('finance.manage', 'Manage student receivables and collections'),
  ('finance.reverse', 'Create immutable financial reversals'),
  ('reports.branch', 'View branch reports'),
  ('reports.consolidated', 'View consolidated reports'),
  ('audit.view', 'View audit logs'),
  ('users.manage_roles', 'Assign application roles'),
  ('users.assign_branch_access', 'Assign branch access'),
  ('self.view', 'View own academic profile'),
  ('absence.justify', 'Submit own absence justification')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role CROSS JOIN permissions permission
WHERE role.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role JOIN permissions permission ON permission.code IN (
  'academic.manage', 'enrollment.manage', 'schedule.manage', 'finance.manage',
  'finance.reverse', 'reports.branch', 'reports.consolidated', 'audit.view',
  'users.assign_branch_access'
)
WHERE role.name = 'GeneralDirector'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role JOIN permissions permission ON permission.code IN (
  'attendance.record', 'teacher.check', 'academic.manage', 'enrollment.manage',
  'schedule.manage', 'finance.manage', 'reports.branch'
)
WHERE role.name = 'BranchDirector'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role JOIN permissions permission ON permission.code IN ('attendance.record', 'teacher.check')
WHERE role.name = 'Teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT role.id, permission.id
FROM roles role JOIN permissions permission ON permission.code IN ('self.view', 'absence.justify')
WHERE role.name = 'Student'
ON CONFLICT DO NOTHING;

INSERT INTO dance_categories(name) VALUES ('Urban'), ('Tropical'), ('Ethnic')
ON CONFLICT DO NOTHING;

INSERT INTO dance_styles(category_id, name)
SELECT category.id, item.name
FROM dance_categories category
JOIN (VALUES
  ('Urban', 'Hip hop'), ('Urban', 'Afro'), ('Urban', 'House'), ('Urban', 'Locking'),
  ('Urban', 'Popping'), ('Urban', 'Waacking'), ('Urban', 'Dancehall'), ('Urban', 'Fem'),
  ('Urban', 'Heels'), ('Tropical', 'Salsa'), ('Tropical', 'Bachata'),
  ('Ethnic', 'Traditional Ecuadorian dances')
) AS item(category_name, name) ON item.category_name = category.name
ON CONFLICT DO NOTHING;

INSERT INTO scholarship_rules(min_attendance_percent, period_months, minimum_sessions, active)
SELECT 90, 2, 8, TRUE
WHERE NOT EXISTS (SELECT 1 FROM scholarship_rules WHERE active = TRUE);
