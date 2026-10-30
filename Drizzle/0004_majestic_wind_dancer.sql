CREATE TABLE "bird_counts" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"ref_no" text,
	"observer" text,
	"rows" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "holidays" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"name" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ramp_inspections" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"flt_no" text,
	"ac_reg" text,
	"payload" text,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "timesheets" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"staff_name" text,
	"staff_department" text,
	"date" text,
	"clock_in" text,
	"clock_out" text,
	"status" text,
	"notes" text,
	"created_at" timestamp
);
