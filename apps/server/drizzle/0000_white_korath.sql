DO $$ BEGIN
 CREATE TYPE "check_status" AS ENUM('SUCCESS', 'FAILED', 'NO_CHANGE', 'CONDITION_MET');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "monitor_status" AS ENUM('ACTIVE', 'PAUSED', 'TRIGGERED_SNOOZED', 'BLOCKED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "monitor_type" AS ENUM('ECOMMERCE', 'STOCK', 'JOB', 'GENERIC_WEB');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "notification_channel" AS ENUM('TELEGRAM', 'EMAIL', 'BOTH');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "check_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"status" "check_status" NOT NULL,
	"recorded_value" numeric(12, 2),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"screenshot_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"type" "monitor_type" NOT NULL,
	"status" "monitor_status" DEFAULT 'ACTIVE' NOT NULL,
	"target_url" text,
	"target_symbol" varchar(50),
	"raw_prompt" text NOT NULL,
	"condition_operator" varchar(20) NOT NULL,
	"target_value" numeric(12, 2),
	"currency" varchar(10) DEFAULT 'INR' NOT NULL,
	"filter_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"frequency_minutes" integer DEFAULT 60 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"next_run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snoozed_until" timestamp with time zone,
	"last_content_hash" varchar(64),
	"last_known_value" numeric(12, 2),
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seen_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"monitor_id" uuid NOT NULL,
	"job_hash" varchar(64) NOT NULL,
	"job_title" varchar(255) NOT NULL,
	"company_name" varchar(255) NOT NULL,
	"apply_url" text NOT NULL,
	"first_detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"telegram_chat_id" varchar(100),
	"preferred_channel" "notification_channel" DEFAULT 'TELEGRAM',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_check_logs_trend" ON "check_logs" ("monitor_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_monitors_scheduler" ON "monitors" ("status","next_run_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_monitors_user_id" ON "monitors" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_seen_jobs_dedup" ON "seen_jobs" ("user_id","job_hash");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "check_logs" ADD CONSTRAINT "check_logs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seen_jobs" ADD CONSTRAINT "seen_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "seen_jobs" ADD CONSTRAINT "seen_jobs_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
