CREATE TABLE "overtime_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"staff_name" text,
	"staff_sn" text,
	"staff_department" text,
	"date" text,
	"start_time" text,
	"end_time" text,
	"hours" real,
	"notes" text,
	"created_at" timestamp,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "roster_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"staff_name" text,
	"staff_department" text,
	"date" text,
	"shift_time" text,
	"status" text,
	"leave_request_id" text,
	"created_at" timestamp
);
