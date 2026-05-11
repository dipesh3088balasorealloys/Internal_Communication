-- Mail Account Management — track Stalwart mail account state per BAL Connect user.
-- Replaces plaintext users.mail_password (kept for backward compat during rollout).
-- New: mail_password_encrypted is AES-256-GCM ciphertext (server-side encryption).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mail_password_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS mail_status VARCHAR(20) NOT NULL DEFAULT 'none'
    CHECK (mail_status IN ('none', 'active', 'disabled', 'error')),
  ADD COLUMN IF NOT EXISTS mail_assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mail_assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mail_last_test_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mail_last_test_ok BOOLEAN;

-- Backfill mail_status for existing rows that already have a mail_password set.
UPDATE users
SET mail_status = 'active'
WHERE mail_status = 'none'
  AND mail_password IS NOT NULL
  AND mail_password <> '';

CREATE INDEX IF NOT EXISTS idx_users_mail_status ON users(mail_status);
