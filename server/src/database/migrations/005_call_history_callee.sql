-- Add callee_id to call_history (routes expect this column)
ALTER TABLE call_history ADD COLUMN IF NOT EXISTS callee_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_calls_callee ON call_history(callee_id);

-- Update status constraint to match route expectations
ALTER TABLE call_history DROP CONSTRAINT IF EXISTS call_history_status_check;
ALTER TABLE call_history ADD CONSTRAINT call_history_status_check
  CHECK (status IN ('initiated', 'ringing', 'answered', 'ended', 'completed', 'missed', 'declined', 'rejected', 'failed'));
