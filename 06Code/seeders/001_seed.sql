INSERT INTO branches(name, city) VALUES ('Norte','Quito'),('Matriz','Quito'),('Sur Guamaní','Quito'),('Tumbaco','Quito'),('Conocoto','Quito') ON CONFLICT DO NOTHING;
INSERT INTO roles(name) VALUES ('Visitor'),('Student'),('Teacher'),('BranchDirector'),('GeneralDirector'),('Admin') ON CONFLICT DO NOTHING;
INSERT INTO dance_categories(name) VALUES ('Urban'),('Tropical'),('Ethnic') ON CONFLICT DO NOTHING;
INSERT INTO dance_styles(category_id, name) SELECT c.id, s.name FROM dance_categories c JOIN (VALUES ('Urban','Hip hop'),('Urban','Afro'),('Urban','House'),('Urban','Locking'),('Urban','Popping'),('Urban','Waacking'),('Urban','Dancehall'),('Urban','Fem'),('Urban','Heels'),('Tropical','Salsa'),('Tropical','Bachata'),('Ethnic','Traditional Ecuadorian dances')) AS s(category,name) ON s.category=c.name ON CONFLICT DO NOTHING;
INSERT INTO scholarship_rules(min_attendance_percent, period_months) VALUES (90, 2);
