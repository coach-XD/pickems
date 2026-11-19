import { asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { bracketPicks, matchOdds, matchPicks, matches, placementPicks, players, stageTeams, stages, teamPlayers, teams } from "@/db/schema";
import { scoreBracket } from "./bracket";
import { allowDemoData, resolveLogo } from "./logos";
import { scorePlayoff, type PlayoffPick } from "./playoff";
import { rankRows, type RankedScore } from "./ranking";
import { addStageScores, emptyStageScore } from "./scoring";
import { deriveStandings, groupByRecord } from "./swiss";
import type { SeriesFormat, Slot } from "./types";

export type StageRow = typeof stages.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;

export type StageTeamView = {
  stageTeamId: string;
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  region: string | null;
  seed: number;
  worldRank: number | null;
  otherRank: number | null;
  vrsPoints: number | null;
  storedLogoUrl?: string | null;
};

export type MatchView = {
  id: string;
  stageId: string;
  round: number;
  format: SeriesFormat;
  scheduledAt: Date;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamAShort: string;
  teamALogo: string | null;
  teamBName: string;
  teamBShort: string;
  teamBLogo: string | null;
};

export async function listStages(includeDemo: boolean): Promise<StageRow[]> {
  const rows = await getDb().select().from(stages).orderBy(asc(stages.sortOrder), asc(stages.startsAt));
  return includeDemo && allowDemoData() ? rows : rows.filter((stage) => !stage.isDemo);
}

export async function hasDemoStage(): Promise<boolean> {
  if (!allowDemoData()) return false;
  const [row] = await getDb().select({ id: stages.id }).from(stages).where(eq(stages.isDemo, true)).limit(1);
  return Boolean(row);
}

export async function getStageBySlug(slug: string): Promise<StageRow | null> {
  const [stage] = await getDb().select().from(stages).where(eq(stages.slug, slug)).limit(1);
  return stage ?? null;
}

export async function getStageById(id: string): Promise<StageRow | null> {
  const [stage] = await getDb().select().from(stages).where(eq(stages.id, id)).limit(1);
  return stage ?? null;
}

export async function listStageTeams(stageId: string): Promise<StageTeamView[]> {
  const rows = await getDb()
    .select({
      stageTeamId: stageTeams.id,
      teamId: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      logoUrl: teams.logoUrl,
      region: teams.region,
      seed: stageTeams.seed,
      worldRank: stageTeams.worldRank,
      otherRank: stageTeams.otherRank,
      vrsPoints: stageTeams.vrsPoints,
    })
    .from(stageTeams)
    .innerJoin(teams, eq(teams.id, stageTeams.teamId))
    .where(eq(stageTeams.stageId, stageId))
    .orderBy(asc(stageTeams.seed));
  return rows.map((team) => ({ ...withLogo(team), storedLogoUrl: team.logoUrl }));
}

export type RosterPlayerView = {
  id: string;
  nickname: string;
  sortOrder: number;
  rating: number | null;
};

export type StageRosterTeam = StageTeamView & { players: RosterPlayerView[] };

export async function listStageRoster(stageId: string): Promise<StageRosterTeam[]> {
  const stageTeamsInOrder = await listStageTeams(stageId);
  if (stageTeamsInOrder.length === 0) return [];
  const rows = await getDb()
    .select({
      id: teamPlayers.id,
      teamId: teamPlayers.teamId,
      nickname: teamPlayers.nickname,
      sortOrder: teamPlayers.sortOrder,
      rating: teamPlayers.rating,
    })
    .from(teamPlayers)
    .where(inArray(teamPlayers.teamId, stageTeamsInOrder.map((team) => team.teamId)))
    .orderBy(asc(teamPlayers.sortOrder), asc(teamPlayers.nickname));
  const byTeam = new Map<string, RosterPlayerView[]>();
  for (const row of rows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push({ id: row.id, nickname: row.nickname, sortOrder: row.sortOrder, rating: row.rating });
    byTeam.set(row.teamId, list);
  }
  return stageTeamsInOrder.map((team) => ({ ...team, players: byTeam.get(team.teamId) ?? [] }));
}

export type AdminRosterTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number | null;
  players: RosterPlayerView[];
};

export async function listRosterForAdmin(): Promise<AdminRosterTeam[]> {
  const db = getDb();
  const teamRows = await db
    .select({
      teamId: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      logoUrl: teams.logoUrl,
      seed: stageTeams.seed,
    })
    .from(teams)
    .leftJoin(stageTeams, eq(stageTeams.teamId, teams.id))
    .leftJoin(stages, eq(stages.id, stageTeams.stageId));
  const playerRows = await db
    .select({
      id: teamPlayers.id,
      teamId: teamPlayers.teamId,
      nickname: teamPlayers.nickname,
      sortOrder: teamPlayers.sortOrder,
      rating: teamPlayers.rating,
    })
    .from(teamPlayers)
    .orderBy(asc(teamPlayers.sortOrder), asc(teamPlayers.nickname));
  const byTeam = new Map<string, RosterPlayerView[]>();
  for (const row of playerRows) {
    const list = byTeam.get(row.teamId) ?? [];
    list.push({ id: row.id, nickname: row.nickname, sortOrder: row.sortOrder, rating: row.rating });
    byTeam.set(row.teamId, list);
  }
  const grouped = new Map<string, AdminRosterTeam>();
  for (const row of teamRows) {
    const current = grouped.get(row.teamId);
    const seed = row.seed ?? null;
    if (!current) {
      grouped.set(row.teamId, {
        teamId: row.teamId,
        name: row.name,
        shortName: row.shortName,
        logoUrl: resolveLogo(row),
        seed,
        players: byTeam.get(row.teamId) ?? [],
      });
      continue;
    }
    if (seed != null && (current.seed == null || seed < current.seed)) current.seed = seed;
  }
  return [...grouped.values()]
    .filter((team) => team.players.length > 0)
    .sort((a, b) => (a.seed ?? 99) - (b.seed ?? 99) || a.name.localeCompare(b.name));
}

export function withLogo<T extends { name: string; logoUrl: string | null }>(team: T): T {
  return { ...team, logoUrl: resolveLogo(team) };
}

export async function listStageMatches(stageId: string): Promise<MatchView[]> {
  const teamA = alias(teams, "team_a");
  const teamB = alias(teams, "team_b");
  const rows = await getDb()
    .select({
      id: matches.id,
      stageId: matches.stageId,
      round: matches.round,
      format: matches.format,
      scheduledAt: matches.scheduledAt,
      winnerId: matches.winnerId,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId,
      teamAName: teamA.name,
      teamAShort: teamA.shortName,
      teamALogo: teamA.logoUrl,
      teamBName: teamB.name,
      teamBShort: teamB.shortName,
      teamBLogo: teamB.logoUrl,
    })
    .from(matches)
    .innerJoin(teamA, eq(teamA.id, matches.teamAId))
    .innerJoin(teamB, eq(teamB.id, matches.teamBId))
    .where(eq(matches.stageId, stageId))
    .orderBy(asc(matches.round), asc(matches.scheduledAt), asc(matches.createdAt));
  return rows.map((match) => ({
    ...match,
    teamALogo: resolveLogo({ name: match.teamAName, logoUrl: match.teamALogo }),
    teamBLogo: resolveLogo({ name: match.teamBName, logoUrl: match.teamBLogo }),
  }));
}

export async function listPlayers(includeDemo: boolean): Promise<PlayerRow[]> {
  const rows = await getDb().select().from(players).orderBy(asc(players.displayName));
  return includeDemo && allowDemoData() ? rows : rows.filter((player) => !player.isDemo);
}

export async function getLeaderboard(stageIds: string[], includeDemoPlayers: boolean): Promise<RankedScore[]> {
  const roster = await listPlayers(includeDemoPlayers);
  if (stageIds.length === 0) {
    return rankRows(
      roster.map((player) => ({
        playerId: player.id,
        name: player.displayName,
        ...emptyStageScore(),
      })),
    );
  }

  const db = getDb();
  const stageMeta = await db.select().from(stages).where(inArray(stages.id, stageIds));
  const kindById = new Map(stageMeta.map((stage) => [stage.id, stage]));
  const matchRows = await db.select().from(matches).where(inArray(matches.stageId, stageIds));
  const brackets = await db.select().from(bracketPicks).where(inArray(bracketPicks.stageId, stageIds));
  const enrolled = await db.select().from(stageTeams).where(inArray(stageTeams.stageId, stageIds));

  const recordsByStage = new Map<string, Map<string, { wins: number; losses: number }>>();
  for (const stageId of stageIds) {
    const standings = deriveStandings(
      enrolled.filter((row) => row.stageId === stageId).map((row) => ({ teamId: row.teamId, seed: row.seed })),
      matchRows
        .filter((match) => match.stageId === stageId)
        .map((match) => ({
          round: match.round,
          scheduledAt: match.scheduledAt,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          winnerId: match.winnerId,
        })),
    );
    recordsByStage.set(
      stageId,
      new Map(standings.map((row) => [row.teamId, { wins: row.wins, losses: row.losses }])),
    );
  }

  return rankRows(
    roster.map((player) => {
      const total = stageIds.reduce((sum, stageId) => {
        const stageMatches = matchRows.filter((match) => match.stageId === stageId);
        const bracket = brackets.find((row) => row.playerId === player.id && row.stageId === stageId);
        const meta = kindById.get(stageId);
        const enrolledTeams = enrolled.filter((row) => row.stageId === stageId).map((row) => ({ teamId: row.teamId, seed: row.seed }));
        if (meta?.kind === "playoff") {
          const score = scorePlayoff({
            teams: enrolledTeams,
            picks: (bracket?.picks ?? []) as PlayoffPick[],
            finalFormat: meta.finalFormat === "bo5" ? "bo5" : "bo3",
            realMatches: stageMatches.map((match) => ({
              teamAId: match.teamAId,
              teamBId: match.teamBId,
              winnerId: match.winnerId,
            })),
          });
          return addStageScores(sum, score);
        }
        const score = scoreBracket({
          teams: enrolled.filter((row) => row.stageId === stageId).map((row) => ({ teamId: row.teamId, seed: row.seed })),
          round1: stageMatches.filter((match) => match.round === 1).map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId })),
          picks: bracket?.picks ?? [],
          realMatches: stageMatches.map((match) => ({
            round: match.round,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            format: match.format,
            winnerId: match.winnerId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
          })),
          realRecords: recordsByStage.get(stageId) ?? new Map(),
        });
        return addStageScores(sum, score);
      }, emptyStageScore());
      return { playerId: player.id, name: player.displayName, ...total };
    }),
  );
}

export type StoredOdds = {
  matchId: string;
  teamAId: string;
  teamBId: string;
  oddsA: number;
  oddsB: number;
  manual: boolean;
};

export async function listStageOdds(stageId: string): Promise<StoredOdds[]> {
  const rows = await getDb()
    .select({
      matchId: matchOdds.matchId,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId,
      oddsA: matchOdds.team1Odds,
      oddsB: matchOdds.team2Odds,
      manual: matchOdds.manual,
    })
    .from(matchOdds)
    .innerJoin(matches, eq(matches.id, matchOdds.matchId))
    .where(eq(matches.stageId, stageId));
  return rows;
}

export async function stageBundle(stageId: string) {
  const teamsInStage = await listStageTeams(stageId);
  const series = await listStageMatches(stageId);
  const standings = deriveStandings(
    teamsInStage.map((team) => ({ teamId: team.teamId, seed: team.seed })),
    series.map((match) => ({
      round: match.round,
      scheduledAt: match.scheduledAt,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      winnerId: match.winnerId,
    })),
  ).map((row) => ({
    ...row,
    team: teamsInStage.find((team) => team.teamId === row.teamId)!,
  }));
  return {
    teams: teamsInStage,
    matches: series,
    standings,
    pools: groupByRecord(standings),
  };
}

export async function picksForPlayer(playerId: string, stageId: string, matchIds: string[]) {
  const db = getDb();
  const slots = await db
    .select()
    .from(placementPicks)
    .where(eq(placementPicks.playerId, playerId));
  const series = matchIds.length
    ? await db.select().from(matchPicks).where(eq(matchPicks.playerId, playerId))
    : [];
  return {
    placements: slots
      .filter((pick) => pick.stageId === stageId)
      .map((pick) => ({ teamId: pick.teamId, slot: pick.slot as Slot })),
    matches: series
      .filter((pick) => matchIds.includes(pick.matchId))
      .map((pick) => ({
        matchId: pick.matchId,
        winnerId: pick.winnerId,
        scoreA: pick.scoreA,
        scoreB: pick.scoreB,
      })),
  };
}

export async function listBrackets(stageId: string) {
  return getDb().select().from(bracketPicks).where(eq(bracketPicks.stageId, stageId));
}

export async function allPicksForStage(stageId: string, matchIds: string[]) {
  const db = getDb();
  const slots = await db.select().from(placementPicks).where(eq(placementPicks.stageId, stageId));
  const series = matchIds.length ? await db.select().from(matchPicks).where(inArray(matchPicks.matchId, matchIds)) : [];
  return { slots, series };
}

export async function listTeamsOutsideStage(stageId: string) {
  const db = getDb();
  const [current] = await db.select({ sortOrder: stages.sortOrder }).from(stages).where(eq(stages.id, stageId)).limit(1);
  const currentOrder = current?.sortOrder ?? 0;
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      seed: stageTeams.seed,
      sortOrder: stages.sortOrder,
      linkStageId: stageTeams.stageId,
    })
    .from(teams)
    .leftJoin(stageTeams, eq(stageTeams.teamId, teams.id))
    .leftJoin(stages, eq(stages.id, stageTeams.stageId));

  const grouped = new Map<string, { id: string; name: string; shortName: string; seed: number | null; previousOrder: number; inThis: boolean }>();
  for (const row of rows) {
    const inThis = row.linkStageId === stageId;
    const existing = grouped.get(row.id);
    if (!existing) {
      grouped.set(row.id, {
        id: row.id,
        name: row.name,
        shortName: row.shortName,
        seed: inThis ? null : row.seed,
        previousOrder: inThis ? -1 : (row.sortOrder ?? -1),
        inThis,
      });
      continue;
    }
    if (inThis) existing.inThis = true;
    else if (row.sortOrder != null && row.sortOrder < currentOrder && row.sortOrder >= existing.previousOrder) {
      existing.seed = row.seed;
      existing.previousOrder = row.sortOrder;
    }
  }

  return [...grouped.values()]
    .filter((team) => !team.inThis)
    .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999) || a.name.localeCompare(b.name))
    .map(({ id, name, shortName, seed }) => ({ id, name, shortName, seed }));
}

export async function adminStageSummaries() {
  const db = getDb();
  const stageRows = await db.select().from(stages).orderBy(asc(stages.sortOrder), asc(stages.startsAt));
  const teamRows = await db.select({ stageId: stageTeams.stageId }).from(stageTeams);
  const matchRows = await db.select({ stageId: matches.stageId, winnerId: matches.winnerId }).from(matches);
  return stageRows.map((stage) => ({
    ...stage,
    teamCount: teamRows.filter((row) => row.stageId === stage.id).length,
    matchCount: matchRows.filter((row) => row.stageId === stage.id).length,
    playedCount: matchRows.filter((row) => row.stageId === stage.id && row.winnerId).length,
  }));
}
