-- Separate mail server password (Stalwart) from BAL Connect login password
-- These are independent: changing login password does NOT affect email
ALTER TABLE users ADD COLUMN IF NOT EXISTS mail_password VARCHAR(255);
