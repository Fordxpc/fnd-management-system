-- Phase 13: non-destructive resignation workflow. Apply only after a Neon backup.
CREATE TABLE IF NOT EXISTS resignation_requests (
  id text PRIMARY KEY NOT NULL,
  staff_id text NOT NULL,
  staff_sn text NOT NULL,
  staff_name text NOT NULL,
  department text NOT NULL,
  requested_last_day text NOT NULL,
  submitted_by_user_id text NOT NULL,
  attachment_name text NOT NULL,
  attachment_data text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp DEFAULT now() NOT NULL,
  reviewed_at timestamp,
  reviewed_by_user_id text,
  reviewer_name text,
  review_note text,
  acceptance_letter text,
  offboarding_status text NOT NULL DEFAULT 'not_started',
  offboarded_at timestamp,
  offboarded_by_user_id text
);
CREATE INDEX IF NOT EXISTS resignation_requests_staff_created_idx ON resignation_requests(staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS resignation_requests_department_status_idx ON resignation_requests(department, status);

-- Prevent concurrent submissions from creating two pending requests for one employee.
CREATE UNIQUE INDEX IF NOT EXISTS resignation_requests_one_pending_per_staff ON resignation_requests(staff_id) WHERE status = 'pending';
