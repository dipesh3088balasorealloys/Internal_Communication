-- Group call metadata — track LiveKit room name + host for each group call.
-- For 1:1 calls these columns stay NULL. For group calls they identify the
-- LiveKit SFU room and the user who started the call (host privileges).

ALTER TABLE call_history
  ADD COLUMN IF NOT EXISTS livekit_room_name VARCHAR(64),
  ADD COLUMN IF NOT EXISTS host_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_call_history_livekit_room ON call_history(livekit_room_name)
  WHERE livekit_room_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_call_history_host ON call_history(host_user_id)
  WHERE host_user_id IS NOT NULL;
