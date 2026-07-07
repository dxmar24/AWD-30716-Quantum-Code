ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

UPDATE users
SET must_change_password = FALSE
WHERE must_change_password IS NULL;
