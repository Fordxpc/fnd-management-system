CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"sn" text,
	"name" text,
	"email" text,
	"department" text,
	"position" text,
	"is_smt" boolean,
	"balance_visible" boolean,
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"role" text,
	"department" text,
	"created_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
