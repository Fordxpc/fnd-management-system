CREATE TABLE IF NOT EXISTS "announcements" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "audience" text NOT NULL,
  "priority" text DEFAULT 'normal',
  "status" text DEFAULT 'published',
  "publish_at" timestamp DEFAULT now(),
  "expires_at" timestamp,
  "created_by" text NOT NULL,
  "created_by_name" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "announcements_publish_at_idx" ON "announcements" ("publish_at");
CREATE INDEX IF NOT EXISTS "announcements_audience_idx" ON "announcements" ("audience");