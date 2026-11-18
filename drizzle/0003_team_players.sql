CREATE TABLE "team_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"nickname" text NOT NULL,
	"sort_order" integer NOT NULL,
	"rating" numeric(4, 2),
	"rating_updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "team_players" ADD CONSTRAINT "team_players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_players_team_nickname" ON "team_players" USING btree ("team_id","nickname");