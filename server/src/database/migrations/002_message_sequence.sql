-- ============================================
-- Migration 002: Message Sequence Numbers + Client ID
-- Purpose: Deterministic message ordering, idempotent sends
-- ============================================

-- 1. Add per-conversation sequence counter
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS next_sequence_number BIGINT NOT NULL DEFAULT 1;

-- 2. Add sequence_number and client_id to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence_number BIGINT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_id VARCHAR(36);

-- 3. Backfill existing messages with deterministic sequence numbers
-- Uses created_at for primary ordering, id as tiebreaker for same-timestamp messages
WITH ranked AS (
  SELECT id, conversation_id,
         ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at ASC, id ASC) AS rn
  FROM messages
)
UPDATE messages m SET sequence_number = r.rn
FROM ranked r WHERE m.id = r.id AND m.sequence_number IS NULL;

-- 4. Update conversations.next_sequence_number to max+1
UPDATE conversations c SET next_sequence_number = COALESCE(
  (SELECT MAX(sequence_number) + 1 FROM messages WHERE conversation_id = c.id), 1
);

-- 5. Make sequence_number NOT NULL after backfill
ALTER TABLE messages ALTER COLUMN sequence_number SET NOT NULL;

-- 6. Atomic sequence allocation function (row-level lock on conversation row)
CREATE OR REPLACE FUNCTION allocate_sequence_number(conv_id UUID)
RETURNS BIGINT AS $$
  UPDATE conversations
  SET next_sequence_number = next_sequence_number + 1
  WHERE id = conv_id
  RETURNING next_sequence_number - 1;
$$ LANGUAGE sql;

-- 7. Unique indexes for ordering and idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_seq
  ON messages(conversation_id, sequence_number);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_conv_client_id
  ON messages(conversation_id, client_id)
  WHERE client_id IS NOT NULL;

-- 8. Replace old timestamp-based index with sequence-based
DROP INDEX IF EXISTS idx_messages_conversation;
CREATE INDEX IF NOT EXISTS idx_messages_conv_seq_desc
  ON messages(conversation_id, sequence_number DESC);
