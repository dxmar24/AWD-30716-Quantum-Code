INSERT INTO branches(name, city) VALUES
('Norte','Quito'),
('Matriz','Quito'),
('Sur Guamani','Quito'),
('Tumbaco','Quito'),
('Conocoto','Quito')
ON CONFLICT DO NOTHING;

INSERT INTO roles(name) VALUES
('Visitor'),
('Student'),
('Teacher'),
('BranchDirector'),
('GeneralDirector'),
('Admin')
ON CONFLICT DO NOTHING;

INSERT INTO permissions(code, description) VALUES
('attendance.record','Record student attendance'),
('teacher.check','Teacher check-in and check-out'),
('academic.manage','Manage branches, students, teachers, styles and schedules'),
('reports.branch','View branch reports'),
('reports.consolidated','View consolidated reports'),
('audit.view','View audit logs'),
('users.manage_roles','Assign internal application roles')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('attendance.record','teacher.check','academic.manage','reports.branch')
WHERE r.name = 'BranchDirector'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('attendance.record','teacher.check')
WHERE r.name = 'Teacher'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN ('reports.branch','reports.consolidated','audit.view')
WHERE r.name = 'GeneralDirector'
ON CONFLICT DO NOTHING;

INSERT INTO dance_categories(name) VALUES
('Urban'),
('Tropical'),
('Ethnic')
ON CONFLICT DO NOTHING;

INSERT INTO dance_styles(category_id, name)
SELECT c.id, s.name
FROM dance_categories c
JOIN (VALUES
('Urban','Hip hop'),
('Urban','Afro'),
('Urban','House'),
('Urban','Locking'),
('Urban','Popping'),
('Urban','Waacking'),
('Urban','Dancehall'),
('Urban','Fem'),
('Urban','Heels'),
('Tropical','Salsa'),
('Tropical','Bachata'),
('Ethnic','Traditional Ecuadorian dances')
) AS s(category,name) ON s.category=c.name
ON CONFLICT DO NOTHING;

INSERT INTO scholarship_rules(min_attendance_percent, period_months)
SELECT 90, 2
WHERE NOT EXISTS (SELECT 1 FROM scholarship_rules WHERE active = TRUE);
