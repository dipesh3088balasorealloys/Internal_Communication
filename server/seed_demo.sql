-- Demo seed data for ConnectHub
-- Run: psql -U connecthub -d connecthub -f seed_demo.sql

-- Get user IDs
DO $$
DECLARE
  testuser_id UUID;
  sarah_id UUID;
  john_id UUID;
  maria_id UUID;
  david_id UUID;
  priya_id UUID;
  admin_id UUID;
  conv1_id UUID; -- DM: testuser <-> sarah
  conv2_id UUID; -- DM: testuser <-> john
  conv3_id UUID; -- DM: testuser <-> david
  conv4_id UUID; -- Group: Engineering Team
  conv5_id UUID; -- Group: Project Alpha
  conv6_id UUID; -- DM: testuser <-> priya
  conv7_id UUID; -- DM: testuser <-> maria
BEGIN
  SELECT id INTO testuser_id FROM users WHERE username = 'testuser';
  SELECT id INTO sarah_id FROM users WHERE username = 'sarah_ahmed';
  SELECT id INTO john_id FROM users WHERE username = 'john_smith';
  SELECT id INTO maria_id FROM users WHERE username = 'maria_garcia';
  SELECT id INTO david_id FROM users WHERE username = 'david_chen';
  SELECT id INTO priya_id FROM users WHERE username = 'priya_sharma';
  SELECT id INTO admin_id FROM users WHERE username = 'admin';

  -- Make admin user actually admin
  UPDATE users SET role = 'admin' WHERE username = 'admin';

  -- ==============================
  -- CONVERSATION 1: DM with Sarah Ahmed
  -- ==============================
  conv1_id := gen_random_uuid();
  INSERT INTO conversations (id, type, created_by, created_at) VALUES (conv1_id, 'direct', testuser_id, NOW() - INTERVAL '3 days');
  INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES
    (conv1_id, testuser_id, NOW() - INTERVAL '3 days'),
    (conv1_id, sarah_id, NOW() - INTERVAL '3 days');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv1_id, sarah_id, 'Hey! Did you see the new deployment pipeline?', 'text', NOW() - INTERVAL '3 hours'),
    (gen_random_uuid(), conv1_id, testuser_id, 'Yes, I just checked it out. The CI/CD setup looks solid', 'text', NOW() - INTERVAL '2 hours 50 minutes'),
    (gen_random_uuid(), conv1_id, sarah_id, 'Great! Can you review my PR when you get a chance? Its the Redis caching implementation', 'text', NOW() - INTERVAL '2 hours 45 minutes'),
    (gen_random_uuid(), conv1_id, testuser_id, 'Sure, I will take a look after lunch', 'text', NOW() - INTERVAL '2 hours 40 minutes'),
    (gen_random_uuid(), conv1_id, sarah_id, 'Thanks! Also the team standup is at 3pm today instead of 2pm', 'text', NOW() - INTERVAL '2 hours 30 minutes'),
    (gen_random_uuid(), conv1_id, testuser_id, 'Got it, thanks for the heads up', 'text', NOW() - INTERVAL '2 hours 20 minutes'),
    (gen_random_uuid(), conv1_id, sarah_id, 'No problem! Let me know if you need help with anything', 'text', NOW() - INTERVAL '1 hour');

  -- ==============================
  -- CONVERSATION 2: DM with John Smith
  -- ==============================
  conv2_id := gen_random_uuid();
  INSERT INTO conversations (id, type, created_by, created_at) VALUES (conv2_id, 'direct', john_id, NOW() - INTERVAL '2 days');
  INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES
    (conv2_id, testuser_id, NOW() - INTERVAL '2 days'),
    (conv2_id, john_id, NOW() - INTERVAL '2 days');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv2_id, john_id, 'Hi! I wanted to discuss the Q2 roadmap priorities', 'text', NOW() - INTERVAL '5 hours'),
    (gen_random_uuid(), conv2_id, testuser_id, 'Sure, what are you thinking?', 'text', NOW() - INTERVAL '4 hours 55 minutes'),
    (gen_random_uuid(), conv2_id, john_id, 'I think we should prioritize the real-time notifications feature. Customer feedback has been strong', 'text', NOW() - INTERVAL '4 hours 50 minutes'),
    (gen_random_uuid(), conv2_id, testuser_id, 'Agreed. That aligns well with what engineering has been working on', 'text', NOW() - INTERVAL '4 hours 45 minutes'),
    (gen_random_uuid(), conv2_id, john_id, 'Perfect. Can we schedule a meeting for Thursday to finalize the sprint goals?', 'text', NOW() - INTERVAL '4 hours 40 minutes'),
    (gen_random_uuid(), conv2_id, testuser_id, 'Thursday works. 10am?', 'text', NOW() - INTERVAL '4 hours 35 minutes'),
    (gen_random_uuid(), conv2_id, john_id, 'Sounds good! I will send the calendar invite', 'text', NOW() - INTERVAL '30 minutes');

  -- ==============================
  -- CONVERSATION 3: DM with David Chen
  -- ==============================
  conv3_id := gen_random_uuid();
  INSERT INTO conversations (id, type, created_by, created_at) VALUES (conv3_id, 'direct', testuser_id, NOW() - INTERVAL '1 day');
  INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES
    (conv3_id, testuser_id, NOW() - INTERVAL '1 day'),
    (conv3_id, david_id, NOW() - INTERVAL '1 day');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv3_id, testuser_id, 'David, quick question about the API gateway config', 'text', NOW() - INTERVAL '6 hours'),
    (gen_random_uuid(), conv3_id, david_id, 'Sure, what is up?', 'text', NOW() - INTERVAL '5 hours 55 minutes'),
    (gen_random_uuid(), conv3_id, testuser_id, 'Should we use rate limiting per user or per IP?', 'text', NOW() - INTERVAL '5 hours 50 minutes'),
    (gen_random_uuid(), conv3_id, david_id, 'Per user with JWT validation is more accurate. We can fallback to IP for unauthenticated endpoints', 'text', NOW() - INTERVAL '5 hours 45 minutes'),
    (gen_random_uuid(), conv3_id, testuser_id, 'Makes sense. I will implement it that way', 'text', NOW() - INTERVAL '5 hours 40 minutes'),
    (gen_random_uuid(), conv3_id, david_id, 'Also, have you seen the new WebSocket performance benchmarks? We are handling 10K concurrent connections now', 'text', NOW() - INTERVAL '45 minutes');

  -- ==============================
  -- CONVERSATION 4: Group - Engineering Team
  -- ==============================
  conv4_id := gen_random_uuid();
  INSERT INTO conversations (id, type, name, created_by, created_at) VALUES (conv4_id, 'group', 'Engineering Team', testuser_id, NOW() - INTERVAL '5 days');
  INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES
    (conv4_id, testuser_id, 'admin', NOW() - INTERVAL '5 days'),
    (conv4_id, sarah_id, 'member', NOW() - INTERVAL '5 days'),
    (conv4_id, david_id, 'member', NOW() - INTERVAL '5 days'),
    (conv4_id, maria_id, 'member', NOW() - INTERVAL '5 days');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv4_id, testuser_id, 'Good morning team! Sprint 14 kickoff meeting in 30 minutes', 'text', NOW() - INTERVAL '8 hours'),
    (gen_random_uuid(), conv4_id, sarah_id, 'I will be there. Just finishing up the code review', 'text', NOW() - INTERVAL '7 hours 55 minutes'),
    (gen_random_uuid(), conv4_id, david_id, 'On my way. I have the architecture diagrams ready to present', 'text', NOW() - INTERVAL '7 hours 50 minutes'),
    (gen_random_uuid(), conv4_id, maria_id, 'I have updated the UI mockups for the dashboard. Will share my screen during the meeting', 'text', NOW() - INTERVAL '7 hours 45 minutes'),
    (gen_random_uuid(), conv4_id, testuser_id, 'Great! This sprint we are focusing on the real-time messaging features', 'text', NOW() - INTERVAL '7 hours 40 minutes'),
    (gen_random_uuid(), conv4_id, david_id, 'I have already set up the WebSocket infrastructure. Should be ready for integration', 'text', NOW() - INTERVAL '7 hours 35 minutes'),
    (gen_random_uuid(), conv4_id, sarah_id, 'The database migrations for the chat schema are also done', 'text', NOW() - INTERVAL '7 hours 30 minutes'),
    (gen_random_uuid(), conv4_id, testuser_id, 'Excellent work everyone! Let us keep this momentum going', 'text', NOW() - INTERVAL '7 hours 25 minutes'),
    (gen_random_uuid(), conv4_id, maria_id, 'Quick update: the new color palette is approved by the design team', 'text', NOW() - INTERVAL '2 hours'),
    (gen_random_uuid(), conv4_id, david_id, 'Nice! The performance tests passed. We can handle 300+ concurrent users easily', 'text', NOW() - INTERVAL '20 minutes');

  -- ==============================
  -- CONVERSATION 5: Group - Project Alpha
  -- ==============================
  conv5_id := gen_random_uuid();
  INSERT INTO conversations (id, type, name, created_by, created_at) VALUES (conv5_id, 'group', 'Project Alpha', john_id, NOW() - INTERVAL '7 days');
  INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) VALUES
    (conv5_id, testuser_id, 'member', NOW() - INTERVAL '7 days'),
    (conv5_id, john_id, 'admin', NOW() - INTERVAL '7 days'),
    (conv5_id, sarah_id, 'member', NOW() - INTERVAL '7 days'),
    (conv5_id, david_id, 'member', NOW() - INTERVAL '7 days'),
    (conv5_id, priya_id, 'member', NOW() - INTERVAL '7 days');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv5_id, john_id, 'Team, the client approved our proposal! Project Alpha is officially a go', 'text', NOW() - INTERVAL '1 day 2 hours'),
    (gen_random_uuid(), conv5_id, sarah_id, 'That is amazing news! When do we start?', 'text', NOW() - INTERVAL '1 day 1 hour 55 minutes'),
    (gen_random_uuid(), conv5_id, john_id, 'Development starts next Monday. I will share the project timeline today', 'text', NOW() - INTERVAL '1 day 1 hour 50 minutes'),
    (gen_random_uuid(), conv5_id, david_id, 'Great! I have already been prototyping some of the core architecture', 'text', NOW() - INTERVAL '1 day 1 hour 45 minutes'),
    (gen_random_uuid(), conv5_id, priya_id, 'I will coordinate with the team for resource allocation. Do we need any additional hires?', 'text', NOW() - INTERVAL '1 day 1 hour 40 minutes'),
    (gen_random_uuid(), conv5_id, testuser_id, 'Congratulations everyone! This is going to be a great project', 'text', NOW() - INTERVAL '1 day 1 hour 35 minutes'),
    (gen_random_uuid(), conv5_id, john_id, 'Budget is approved for 2 additional developers. Priya, can you start the recruitment?', 'text', NOW() - INTERVAL '1 day 1 hour'),
    (gen_random_uuid(), conv5_id, priya_id, 'Already on it! I will post the positions by end of today', 'text', NOW() - INTERVAL '1 day');

  -- ==============================
  -- CONVERSATION 6: DM with Priya Sharma
  -- ==============================
  conv6_id := gen_random_uuid();
  INSERT INTO conversations (id, type, created_by, created_at) VALUES (conv6_id, 'direct', priya_id, NOW() - INTERVAL '12 hours');
  INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES
    (conv6_id, testuser_id, NOW() - INTERVAL '12 hours'),
    (conv6_id, priya_id, NOW() - INTERVAL '12 hours');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv6_id, priya_id, 'Hi! Just a reminder about the team building event next Friday', 'text', NOW() - INTERVAL '10 hours'),
    (gen_random_uuid(), conv6_id, testuser_id, 'Thanks for the reminder! Is it at the usual venue?', 'text', NOW() - INTERVAL '9 hours 50 minutes'),
    (gen_random_uuid(), conv6_id, priya_id, 'Yes, conference room B on the 3rd floor. Lunch will be provided', 'text', NOW() - INTERVAL '9 hours 45 minutes'),
    (gen_random_uuid(), conv6_id, testuser_id, 'Perfect, count me in!', 'text', NOW() - INTERVAL '9 hours');

  -- ==============================
  -- CONVERSATION 7: DM with Maria Garcia
  -- ==============================
  conv7_id := gen_random_uuid();
  INSERT INTO conversations (id, type, created_by, created_at) VALUES (conv7_id, 'direct', maria_id, NOW() - INTERVAL '6 hours');
  INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES
    (conv7_id, testuser_id, NOW() - INTERVAL '6 hours'),
    (conv7_id, maria_id, NOW() - INTERVAL '6 hours');

  INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES
    (gen_random_uuid(), conv7_id, maria_id, 'Hey! I finished the new dashboard mockups. Want to take a look?', 'text', NOW() - INTERVAL '4 hours'),
    (gen_random_uuid(), conv7_id, testuser_id, 'Absolutely! Share them whenever you are ready', 'text', NOW() - INTERVAL '3 hours 55 minutes'),
    (gen_random_uuid(), conv7_id, maria_id, 'Sent them to your email. The dark mode version looks really sleek', 'text', NOW() - INTERVAL '3 hours 50 minutes'),
    (gen_random_uuid(), conv7_id, testuser_id, 'Just opened them — these look incredible! Love the color scheme', 'text', NOW() - INTERVAL '3 hours 45 minutes'),
    (gen_random_uuid(), conv7_id, maria_id, 'Thanks! I tried to match it with our brand guidelines. Let me know if you want any changes', 'text', NOW() - INTERVAL '15 minutes');

  RAISE NOTICE 'Demo data seeded successfully!';
  RAISE NOTICE 'Conversations created: 7 (5 DMs + 2 groups)';
  RAISE NOTICE 'Messages created: ~45';
END $$;
