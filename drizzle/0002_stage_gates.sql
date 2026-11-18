ALTER TABLE "stages" ADD COLUMN "picks_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "kind" text DEFAULT 'swiss' NOT NULL;--> statement-breakpoint
ALTER TABLE "stages" ADD COLUMN "final_format" text DEFAULT 'bo3' NOT NULL;