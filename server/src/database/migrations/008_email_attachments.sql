-- Add attachments column to sent_emails for storing attachment metadata
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';
