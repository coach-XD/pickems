CREATE TABLE "match_odds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"team1_odds" numeric(6, 3) NOT NULL,
	"team2_odds" numeric(6, 3) NOT NULL,
	"bookmaker" text NOT NULL,
	"source" text NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "odds_fetch_lock" (
	"id" integer PRIMARY KEY NOT NULL,
	"locked_until" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"month_key" text DEFAULT '' NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stage_teams" ADD COLUMN "vrs_points" integer;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "oddspapi_id" integer;--> statement-breakpoint
ALTER TABLE "match_odds" ADD CONSTRAINT "match_odds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_odds_match" ON "match_odds" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_oddspapi_id" ON "teams" USING btree ("oddspapi_id");--> statement-breakpoint
INSERT INTO "odds_fetch_lock" ("id", "locked_until", "last_attempt_at", "month_key", "request_count") VALUES (1, '1970-01-01T00:00:00Z', '1970-01-01T00:00:00Z', '', 0);