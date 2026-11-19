"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { matchOdds, matches, players, stages, stageTeams, teamPlayers, teams } from "@/db/schema";
import { isAdmin } from "@/lib/auth";
import { parseIso } from "@/lib/time";
import type { SeriesFormat } from "@/lib/types";
import { isUniqueViolation, logoUrlSchema, scoresForWinner, slugify } from "@/lib/validators";

function bounce(path: string, code: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${encodeURIComponent(code)}`);
}

async function gate() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function refresh(slug?: string) {
  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/stages");
  revalidatePath("/admin");
  revalidatePath("/admin/players");
  revalidatePath("/admin/rosters");
  if (slug) {
    revalidatePath(`/stages/${slug}`);
    revalidatePath(`/stages/${slug}/compare`);
  }
}

function requiredText(value: FormDataEntryValue | null, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^\d{1,4}$/.test(raw)) return Number.NaN;
  return Number(raw);
}

export async function createStage(formData: FormData) {
  await gate();
  const name = requiredText(formData.get("name"), 60);
  const startsAt = parseIso(String(formData.get("startsAt") ?? ""));
  const endsRaw = String(formData.get("endsAt") ?? "");
  const endsAt = endsRaw.trim() ? parseIso(endsRaw) : null;
  const sortOrder = optionalInt(formData.get("sortOrder"));
  if (!name) bounce("/admin/stages/new", "stage-name");
  if (!startsAt || (endsRaw.trim() && !endsAt)) bounce("/admin/stages/new", "stage-time");

  const db = getDb();
  let slug = slugify(name);
  if (!slug) bounce("/admin/stages/new", "stage-name");
  const existing = await db.select({ slug: stages.slug }).from(stages);
  const taken = new Set(existing.map((row) => row.slug));
  if (taken.has(slug)) {
    let n = 2;
    while (taken.has(`${slug}-${n}`)) n += 1;
    slug = `${slug}-${n}`;
  }

  const [stage] = await db
    .insert(stages)
    .values({
      name,
      slug,
      startsAt,
      endsAt,
      sortOrder: sortOrder != null && !Number.isNaN(sortOrder) ? sortOrder : existing.length + 1,
      isDemo: false,
    })
    .returning();
  refresh();
  redirect(`/admin/stages/${stage.id}?notice=created`);
}

export async function updateStage(formData: FormData) {
  await gate();
  const id = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${id}`;
  const name = requiredText(formData.get("name"), 60);
  const startsAt = parseIso(String(formData.get("startsAt") ?? ""));
  const endsRaw = String(formData.get("endsAt") ?? "");
  const endsAt = endsRaw.trim() ? parseIso(endsRaw) : null;
  const sortOrder = optionalInt(formData.get("sortOrder"));
  if (!name) bounce(back, "stage-name");
  if (!startsAt || (endsRaw.trim() && !endsAt) || sortOrder == null || Number.isNaN(sortOrder)) {
    bounce(back, "stage-time");
  }
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  const picksOpen = String(formData.get("picksOpen") ?? "0") === "1";
  const showPicksBeforeLock = String(formData.get("showPicksBeforeLock") ?? "0") === "1";
  const finalFormat = String(formData.get("finalFormat") ?? stage.finalFormat) === "bo5" ? "bo5" : "bo3";
  await db.update(stages).set({ name, startsAt, endsAt, sortOrder, picksOpen, showPicksBeforeLock, finalFormat }).where(eq(stages.id, id));
  refresh(stage.slug);
  redirect(`${back}?notice=saved`);
}

export async function deleteStage(formData: FormData) {
  await gate();
  const id = String(formData.get("stageId") ?? "");
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, id)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  await db.delete(stages).where(eq(stages.id, id));
  refresh(stage.slug);
  redirect("/admin?notice=deleted");
}

export async function saveTeams(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const ids = formData.getAll("stageTeamId").map(String);
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");

  const rows = ids.map((stageTeamId) => {
    const name = requiredText(formData.get(`name_${stageTeamId}`), 40);
    const shortName = requiredText(formData.get(`short_${stageTeamId}`), 8);
    const region = requiredText(formData.get(`region_${stageTeamId}`), 24);
    const logo = logoUrlSchema.safeParse(String(formData.get(`logo_${stageTeamId}`) ?? ""));
    const seed = optionalInt(formData.get(`seed_${stageTeamId}`));
    const worldRank = optionalInt(formData.get(`world_${stageTeamId}`));
    const otherRank = optionalInt(formData.get(`other_${stageTeamId}`));
    return { stageTeamId, name, shortName, region, logo, seed, worldRank, otherRank };
  });

  if (rows.some((row) => !row.name || !row.shortName || !row.logo.success)) bounce(back, "team-fields");
  if (rows.some((row) => row.seed == null || Number.isNaN(row.seed) || row.seed < 1 || row.seed > 32)) {
    bounce(back, "seed-range");
  }
  if (rows.some((row) => Number.isNaN(row.worldRank) || Number.isNaN(row.otherRank))) bounce(back, "team-fields");
  if (new Set(rows.map((row) => row.seed)).size !== rows.length) bounce(back, "seed-dup");

  try {
    await db.transaction(async (tx) => {
      const current = await tx.select().from(stageTeams).where(eq(stageTeams.stageId, stageId));
      const byId = new Map(current.map((row) => [row.id, row]));
      for (const row of rows) {
        const link = byId.get(row.stageTeamId);
        if (!link || link.stageId !== stageId) throw new Error("missing-team");
        await tx
          .update(teams)
          .set({
            name: row.name,
            shortName: row.shortName,
            region: row.region || null,
            logoUrl: row.logo.success ? row.logo.data : null,
          })
          .where(eq(teams.id, link.teamId));
        await tx
          .update(stageTeams)
          .set({ seed: row.seed! + 1000 })
          .where(eq(stageTeams.id, row.stageTeamId));
      }
      for (const row of rows) {
        await tx
          .update(stageTeams)
          .set({
            seed: row.seed!,
            worldRank: row.worldRank ?? null,
            otherRank: row.otherRank ?? null,
          })
          .where(eq(stageTeams.id, row.stageTeamId));
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "team-name");
    if (error instanceof Error && error.message === "missing-team") bounce(back, "team-missing");
    throw error;
  }

  refresh(stage.slug);
  redirect(`${back}?notice=saved`);
}

export async function addTeam(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const name = requiredText(formData.get("name"), 40);
  const shortName = requiredText(formData.get("short"), 8);
  const region = requiredText(formData.get("region"), 24);
  const logo = logoUrlSchema.safeParse(String(formData.get("logo") ?? ""));
  const seed = optionalInt(formData.get("seed"));
  const worldRank = optionalInt(formData.get("world"));
  const otherRank = optionalInt(formData.get("other"));
  if (!name || !shortName || !logo.success) bounce(back, "team-fields");
  if (seed == null || Number.isNaN(seed) || seed < 1 || seed > 32) bounce(back, "seed-range");
  if (Number.isNaN(worldRank) || Number.isNaN(otherRank)) bounce(back, "team-fields");

  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");

  try {
    await db.transaction(async (tx) => {
      const [found] = await tx.select().from(teams).where(eq(teams.name, name)).limit(1);
      let teamId = found?.id;
      if (found) {
        teamId = found.id;
        await tx
          .update(teams)
          .set({ shortName, region: region || null, logoUrl: logo.data })
          .where(eq(teams.id, found.id));
      } else {
        const [created] = await tx
          .insert(teams)
          .values({ name, shortName, region: region || null, logoUrl: logo.data })
          .returning();
        teamId = created.id;
      }
      await tx.insert(stageTeams).values({
        stageId,
        teamId: teamId!,
        seed,
        worldRank: worldRank ?? null,
        otherRank: otherRank ?? null,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "seed-dup");
    throw error;
  }

  refresh(stage.slug);
  redirect(`${back}?notice=saved`);
}

export async function attachTeams(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const ids = formData.getAll("teamId").map(String).filter(Boolean);
  if (ids.length === 0) bounce(back, "team-missing");
  const rows = ids.map((teamId) => ({ teamId, seed: optionalInt(formData.get(`seed_${teamId}`)) }));
  if (rows.some((row) => row.seed == null || Number.isNaN(row.seed) || row.seed < 1 || row.seed > 32)) bounce(back, "seed-range");
  if (new Set(rows.map((row) => row.seed)).size !== rows.length) bounce(back, "seed-dup");
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  const known = await db.select({ id: teams.id }).from(teams);
  const knownIds = new Set(known.map((team) => team.id));
  if (rows.some((row) => !knownIds.has(row.teamId))) bounce(back, "team-missing");
  const enrolled = await db.select({ teamId: stageTeams.teamId, seed: stageTeams.seed }).from(stageTeams).where(eq(stageTeams.stageId, stageId));
  const takenTeams = new Set(enrolled.map((row) => row.teamId));
  const takenSeeds = new Set(enrolled.map((row) => row.seed));
  if (rows.some((row) => takenTeams.has(row.teamId))) bounce(back, "team-in");
  if (rows.some((row) => takenSeeds.has(row.seed!))) bounce(back, "seed-dup");
  try {
    await db.insert(stageTeams).values(
      rows.map((row) => ({
        stageId,
        teamId: row.teamId,
        seed: row.seed!,
        worldRank: null,
        otherRank: null,
      })),
    );
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "seed-dup");
    throw error;
  }
  refresh(stage.slug);
  redirect(`${back}?notice=saved#teams`);
}

export async function attachTeam(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const teamId = String(formData.get("teamId") ?? "");
  const seed = optionalInt(formData.get("seed"));
  const worldRank = optionalInt(formData.get("world"));
  const otherRank = optionalInt(formData.get("other"));
  if (!teamId) bounce(back, "team-missing");
  if (seed == null || Number.isNaN(seed) || seed < 1 || seed > 32) bounce(back, "seed-range");
  if (Number.isNaN(worldRank) || Number.isNaN(otherRank)) bounce(back, "team-fields");
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) bounce(back, "team-missing");
  const [already] = await db
    .select({ id: stageTeams.id })
    .from(stageTeams)
    .where(and(eq(stageTeams.stageId, stageId), eq(stageTeams.teamId, teamId)))
    .limit(1);
  if (already) bounce(back, "team-in");
  try {
    await db.insert(stageTeams).values({
      stageId,
      teamId,
      seed,
      worldRank: worldRank ?? null,
      otherRank: otherRank ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "seed-dup");
    throw error;
  }
  refresh(stage.slug);
  redirect(`${back}?notice=saved#teams`);
}

export async function removeTeam(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  const used = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(eq(matches.stageId, stageId), or(eq(matches.teamAId, teamId), eq(matches.teamBId, teamId))))
    .limit(1);
  if (used.length) bounce(back, "team-used");
  await db.delete(stageTeams).where(and(eq(stageTeams.stageId, stageId), eq(stageTeams.teamId, teamId)));
  refresh(stage.slug);
  redirect(`${back}?notice=saved`);
}

function readSeries(formData: FormData, index: number) {
  const teamAId = String(formData.get(`teamA_${index}`) ?? "");
  const teamBId = String(formData.get(`teamB_${index}`) ?? "");
  const format = String(formData.get(`format_${index}`) ?? "bo1") as SeriesFormat;
  const round = optionalInt(formData.get(`round_${index}`));
  const scheduledAt = parseIso(String(formData.get(`time_${index}`) ?? ""));
  return { teamAId, teamBId, format, round, scheduledAt };
}

async function assertPair(stageId: string, teamAId: string, teamBId: string, allowRematch: boolean, ignoreMatchId?: string) {
  if (!teamAId || !teamBId || teamAId === teamBId) return "match-teams" as const;
  const db = getDb();
  const enrolled = await db.select({ teamId: stageTeams.teamId }).from(stageTeams).where(eq(stageTeams.stageId, stageId));
  const allowed = new Set(enrolled.map((row) => row.teamId));
  if (!allowed.has(teamAId) || !allowed.has(teamBId)) return "team-missing" as const;
  if (allowRematch) return null;
  const existing = await db.select().from(matches).where(eq(matches.stageId, stageId));
  const clash = existing.some((match) => {
    if (ignoreMatchId && match.id === ignoreMatchId) return false;
    const same =
      (match.teamAId === teamAId && match.teamBId === teamBId) ||
      (match.teamAId === teamBId && match.teamBId === teamAId);
    return same;
  });
  return clash ? ("rematch" as const) : null;
}

export async function addMatch(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const round = optionalInt(formData.get("round_0"));
  const format = String(formData.get("format_0") ?? "bo1");
  const scheduledAt = parseIso(String(formData.get("time_0") ?? ""));
  const teamAId = String(formData.get("teamA_0") ?? "");
  const teamBId = String(formData.get("teamB_0") ?? "");
  if (round == null || Number.isNaN(round) || round < 1 || round > 5) bounce(back, "round");
  if (format !== "bo1" && format !== "bo3") bounce(back, "match-result");
  if (!scheduledAt) bounce(back, "match-time");
  const problem = await assertPair(stageId, teamAId, teamBId, formData.get("allowRematch") === "1");
  if (problem) bounce(back, problem);

  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");
  await db.insert(matches).values({ stageId, round, format, scheduledAt, teamAId, teamBId });
  refresh(stage.slug);
  redirect(`${back}?notice=saved#matches`);
}

export async function createSuggestedRound(formData: FormData) {
  await gate();
  const stageId = String(formData.get("stageId") ?? "");
  const back = `/admin/stages/${stageId}`;
  const count = Number(formData.get("count") ?? 0);
  const round = optionalInt(formData.get("round"));
  if (!Number.isInteger(count) || count < 1 || count > 16) bounce(back, "round");
  if (round == null || Number.isNaN(round) || round < 1 || round > 5) bounce(back, "round");

  const drafts = [];
  for (let index = 0; index < count; index += 1) {
    if (String(formData.get(`include_${index}`) ?? "") !== "1") continue;
    const row = readSeries(formData, index);
    if (row.format !== "bo1" && row.format !== "bo3") bounce(back, "match-result");
    if (!row.scheduledAt) bounce(back, "match-time");
    drafts.push(row);
  }
  if (!drafts.length) bounce(back, "match-teams");

  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce("/admin", "not-found");

  const used = new Set<string>();
  for (const draft of drafts) {
    if (used.has(draft.teamAId) || used.has(draft.teamBId)) bounce(back, "match-teams");
    used.add(draft.teamAId);
    used.add(draft.teamBId);
    const problem = await assertPair(stageId, draft.teamAId, draft.teamBId, formData.get("allowRematch") === "1");
    if (problem) bounce(back, problem);
  }

  await db.insert(matches).values(
    drafts.map((draft) => ({
      stageId,
      round,
      format: draft.format,
      scheduledAt: draft.scheduledAt!,
      teamAId: draft.teamAId,
      teamBId: draft.teamBId,
    })),
  );
  refresh(stage.slug);
  redirect(`${back}?notice=saved#matches`);
}

export async function updateMatch(formData: FormData) {
  await gate();
  const matchId = String(formData.get("matchId") ?? "");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) bounce("/admin", "not-found");
  const back = `/admin/stages/${match.stageId}`;
  const round = optionalInt(formData.get("round"));
  const format = String(formData.get("format") ?? "");
  const scheduledAt = parseIso(String(formData.get("scheduledAt") ?? ""));
  const teamAId = String(formData.get("teamAId") ?? "");
  const teamBId = String(formData.get("teamBId") ?? "");
  if (round == null || Number.isNaN(round) || round < 1 || round > 5) bounce(back, "round");
  if (format !== "bo1" && format !== "bo3") bounce(back, "match-result");
  if (!scheduledAt) bounce(back, "match-time");
  const problem = await assertPair(match.stageId, teamAId, teamBId, formData.get("allowRematch") === "1", match.id);
  if (problem) bounce(back, problem);

  const winnerStillValid = match.winnerId === teamAId || match.winnerId === teamBId;
  await db
    .update(matches)
    .set({
      round,
      format,
      scheduledAt,
      teamAId,
      teamBId,
      winnerId: winnerStillValid ? match.winnerId : null,
      scoreA: winnerStillValid ? match.scoreA : null,
      scoreB: winnerStillValid ? match.scoreB : null,
    })
    .where(eq(matches.id, match.id));

  const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  refresh(stage?.slug);
  redirect(`${back}?notice=saved#m-${match.id}`);
}

export async function setResult(formData: FormData) {
  await gate();
  const matchId = String(formData.get("matchId") ?? "");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) bounce("/admin", "not-found");
  const back = `/admin/stages/${match.stageId}`;
  const winnerId = String(formData.get("winnerId") ?? "");
  if (!winnerId) {
    await db.update(matches).set({ winnerId: null, scoreA: null, scoreB: null }).where(eq(matches.id, match.id));
  } else {
    const marginRaw = String(formData.get("margin") ?? "");
    const margin = marginRaw === "2-0" || marginRaw === "2-1" ? marginRaw : null;
    try {
      const scores = scoresForWinner({
        format: match.format,
        winnerId,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        margin,
      });
      await db
        .update(matches)
        .set({ winnerId, scoreA: scores.scoreA, scoreB: scores.scoreB })
        .where(eq(matches.id, match.id));
    } catch {
      bounce(back, "match-result");
    }
  }
  const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  refresh(stage?.slug);
  redirect(`${back}?notice=saved#m-${match.id}`);
}

export async function saveMatchOdds(formData: FormData) {
  await gate();
  const matchId = String(formData.get("matchId") ?? "");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) bounce("/admin", "not-found");
  const back = `/admin/stages/${match.stageId}`;
  const rawA = String(formData.get("oddsA") ?? "").trim();
  const rawB = String(formData.get("oddsB") ?? "").trim();
  if (!rawA && !rawB) {
    await db.delete(matchOdds).where(eq(matchOdds.matchId, match.id));
    refresh();
    redirect(`${back}?notice=saved#m-${match.id}`);
  }
  const oddsA = Number(rawA);
  const oddsB = Number(rawB);
  if (!(oddsA > 1) || !(oddsB > 1) || oddsA > 100 || oddsB > 100) bounce(back, "match-result");
  await db
    .insert(matchOdds)
    .values({
      matchId: match.id,
      team1Odds: oddsA,
      team2Odds: oddsB,
      bookmaker: "admin",
      source: "admin",
      manual: true,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: matchOdds.matchId,
      set: { team1Odds: oddsA, team2Odds: oddsB, bookmaker: "admin", source: "admin", manual: true, fetchedAt: new Date() },
    });
  refresh();
  redirect(`${back}?notice=saved#m-${match.id}`);
}

export async function deleteMatch(formData: FormData) {
  await gate();
  const matchId = String(formData.get("matchId") ?? "");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) bounce("/admin", "not-found");
  await db.delete(matches).where(eq(matches.id, match.id));
  const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  refresh(stage?.slug);
  redirect(`/admin/stages/${match.stageId}?notice=deleted#matches`);
}

function optionalRating(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (!/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(raw)) return Number.NaN;
  const rating = Number(raw);
  if (rating > 3) return Number.NaN;
  return rating;
}

export async function saveRoster(formData: FormData) {
  await gate();
  const teamId = String(formData.get("teamId") ?? "");
  const ids = formData.getAll("playerId").map(String);
  const back = "/admin/rosters";
  if (!teamId || ids.length === 0) bounce(back, "not-found");
  const db = getDb();
  const rows = await db.select().from(teamPlayers).where(eq(teamPlayers.teamId, teamId));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const next = ids.map((id) => {
    const nickname = requiredText(formData.get(`nickname_${id}`), 24);
    const rating = optionalRating(formData.get(`rating_${id}`));
    return { id, nickname, rating };
  });
  if (next.some((row) => !byId.has(row.id) || !row.nickname || Number.isNaN(row.rating))) bounce(back, "roster-fields");
  const names = new Set(next.map((row) => row.nickname.toLowerCase()));
  if (names.size !== next.length) bounce(back, "roster-fields");

  try {
    for (const row of next) {
      const current = byId.get(row.id)!;
      const ratingChanged = (current.rating == null ? null : current.rating.toFixed(2)) !== (row.rating == null ? null : row.rating.toFixed(2));
      if (current.nickname === row.nickname && !ratingChanged) continue;
      await db
        .update(teamPlayers)
        .set({
          nickname: row.nickname,
          rating: row.rating,
          ratingUpdatedAt: ratingChanged ? new Date() : current.ratingUpdatedAt,
        })
        .where(and(eq(teamPlayers.id, row.id), eq(teamPlayers.teamId, teamId)));
    }
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "roster-fields");
    throw error;
  }
  refresh();
  redirect(`${back}?notice=saved#team-${teamId}`);
}

export async function removePlayer(formData: FormData) {
  await gate();
  const playerId = String(formData.get("playerId") ?? "");
  await getDb().delete(players).where(eq(players.id, playerId));
  refresh();
  redirect("/admin/players?notice=removed");
}
