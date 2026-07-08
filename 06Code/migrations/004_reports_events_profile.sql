ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_updated_at TIMESTAMPTZ;

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS name VARCHAR(120);

CREATE TABLE IF NOT EXISTS academy_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID REFERENCES branches(id),
  title VARCHAR(160) NOT NULL,
  description TEXT,
  level VARCHAR(3) NOT NULL DEFAULT 'ALL' CHECK(level IN ('B1','B2','ALL')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location VARCHAR(160),
  show_income NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_events_branch ON academy_events(branch_id);
CREATE INDEX IF NOT EXISTS idx_academy_events_level ON academy_events(level);
CREATE INDEX IF NOT EXISTS idx_academy_events_starts_at ON academy_events(starts_at);

CREATE TABLE IF NOT EXISTS student_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id),
  branch_id UUID REFERENCES branches(id),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  concept VARCHAR(100) NOT NULL,
  period VARCHAR(7) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('paid','pending','overdue','cancelled')),
  paid_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, period, concept)
);

CREATE INDEX IF NOT EXISTS idx_student_payments_student ON student_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_branch ON student_payments(branch_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_status ON student_payments(status);
CREATE INDEX IF NOT EXISTS idx_student_payments_period ON student_payments(period);
