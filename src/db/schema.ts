import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const seriesFormatEnum = pgEnum("series_format", ["bo1", "bo3"]);
export const placementSlotEnum = pgEnum("placement_slot", ["perfect", "winless", "advance"]);

export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  displayNameKey: text("display_name_key").notNull(),
  pinHash: text("pin_hash").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("players_name_key").on(table.displayNameKey)]);

export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
  sortOrder: integer("sort_order").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("stages_slug").on(table.slug)]);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  logoUrl: text("logo_url"),
  region: text("region"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("teams_name").on(table.name)]);

export const stageTeams = pgTable("stage_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  seed: integer("seed").notNull(),
  worldRank: integer("world_rank"),
  otherRank: integer("other_rank"),
}, (table) => [
  uniqueIndex("stage_teams_stage_team").on(table.stageId, table.teamId),
  uniqueIndex("stage_teams_stage_seed").on(table.stageId, table.seed),
]);

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  stageId: uuid("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  teamAId: uuid("team_a_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  teamBId: uuid("team_b_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  format: seriesFormatEnum("format").notNull().default("bo1"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "date" }).notNull(),
  winnerId: uuid("winner_id").references(() => teams.id, { onDelete: "restrict" }),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const placementPicks = pgTable("placement_picks", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  stageId: uuid("stage_id").notNull().references(() => stages.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  slot: placementSlotEnum("slot").notNull(),
}, (table) => [uniqueIndex("placement_player_stage_team").on(table.playerId, table.stageId, table.teamId)]);

export const matchPicks = pgTable("match_picks", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  winnerId: uuid("winner_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
  scoreA: integer("score_a"),
  scoreB: integer("score_b"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("match_pick_player_match").on(table.playerId, table.matchId)]);
