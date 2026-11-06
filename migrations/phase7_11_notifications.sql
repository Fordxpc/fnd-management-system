-- Run on Neon before deploying the notifications feature.
-- Additive migration: does not alter staff/leave/roster records.
CREATE TABLE IF NOT EXISTS app_notifications (
  id text PRIMARY KEY, user_id text NOT NULL, kind text NOT NULL,
  title text NOT NULL, body text NOT NULL, target_page text NOT NULL,
  source_id text, dedupe_key text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now(), read_at timestamp
);
CREATE INDEX IF NOT EXISTS app_notifications_user_created_idx
  ON app_notifications(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS app_push_subscriptions (
  id text PRIMARY KEY, user_id text NOT NULL, endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL, auth text NOT NULL, created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_push_subscriptions_user_idx
  ON app_push_subscriptions(user_id);
