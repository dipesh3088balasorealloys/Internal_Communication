-- Add threading columns to sent_emails so we can walk conversation chains via DB
-- without needing IMAP. This is critical for finding parent emails by Message-ID
-- when the parent isn't in the current user's IMAP mailbox (e.g., they were Cc'd
-- on a reply but not on the original).

ALTER TABLE sent_emails
  ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS email_references TEXT;

-- Index for fast reverse lookups: "find all emails that reply to this Message-ID"
CREATE INDEX IF NOT EXISTS idx_sent_emails_message_id ON sent_emails(message_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_in_reply_to ON sent_emails(in_reply_to);
