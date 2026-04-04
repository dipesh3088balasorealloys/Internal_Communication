-- Add 'deleted' status to sent_emails
ALTER TABLE sent_emails DROP CONSTRAINT IF EXISTS sent_emails_status_check;
ALTER TABLE sent_emails ADD CONSTRAINT sent_emails_status_check
  CHECK (status IN ('sent', 'failed', 'draft', 'deleted'));
