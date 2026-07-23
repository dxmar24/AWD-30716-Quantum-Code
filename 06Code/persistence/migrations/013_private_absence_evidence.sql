ALTER TABLE absence_justifications
  ADD COLUMN IF NOT EXISTS evidence_file_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS evidence_mime_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS evidence_size INTEGER,
  ADD COLUMN IF NOT EXISTS evidence_data BYTEA;

ALTER TABLE absence_justifications
  DROP CONSTRAINT IF EXISTS absence_justifications_evidence_size_check;

ALTER TABLE absence_justifications
  ADD CONSTRAINT absence_justifications_evidence_size_check
  CHECK (evidence_size IS NULL OR evidence_size BETWEEN 1 AND 5242880);

ALTER TABLE absence_justifications
  DROP CONSTRAINT IF EXISTS absence_justifications_evidence_type_check;

ALTER TABLE absence_justifications
  ADD CONSTRAINT absence_justifications_evidence_type_check
  CHECK (
    evidence_mime_type IS NULL
    OR evidence_mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  );
