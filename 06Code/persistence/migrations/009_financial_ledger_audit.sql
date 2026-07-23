ALTER TABLE student_payments
  ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20) NOT NULL DEFAULT 'charge',
  ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES student_payments(id),
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE student_payments
  DROP CONSTRAINT IF EXISTS student_payments_student_id_period_concept_key;

ALTER TABLE student_payments
  DROP CONSTRAINT IF EXISTS student_payments_ledger_check;

ALTER TABLE student_payments
  ADD CONSTRAINT student_payments_ledger_check CHECK (
    (transaction_type = 'charge' AND amount > 0 AND reversal_of_id IS NULL)
    OR
    (transaction_type = 'reversal' AND amount < 0 AND reversal_of_id IS NOT NULL
      AND reversal_reason IS NOT NULL AND length(trim(reversal_reason)) >= 5)
  ) NOT VALID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM student_payments
    WHERE status <> 'cancelled' AND transaction_type = 'charge'
    GROUP BY student_id, period, lower(trim(concept))
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_student_payment_active_charge
      ON student_payments(student_id, period, lower(trim(concept)))
      WHERE status <> 'cancelled' AND transaction_type = 'charge';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_payment_reversal
  ON student_payments(reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_payments_branch_period_status
  ON student_payments(branch_id, period, status);
