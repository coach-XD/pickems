"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { bracketPicks, matchPicks, matches, placementPicks, stages, stageTeams } from "@/db/schema";
import { picksFromBracket, projectBracket, type BracketPick } from "@/lib/bracket";
import { getSessionPlayer } from "@/lib/auth";
import { earliest, isLocked } from "@/lib/time";
import { SLOT_LIMITS, type Slot } from "@/lib/types";
import { scoresForWinner } from "@/lib/validators";

function bounce(path: string, code: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${encodeURIComponent(code)}`);
}

function refresh(slug: string) {
  revalidatePath("/");
  revalidatePath("/picks");
  revalidatePath("/stages");
  revalidatePath(`/stages/${slug}`);
  revalidatePath(`/stages/${slug}/compare`);
}

const SLOTS = new Set<Slot>(["perfect", "winless", "advance"]);

export async function savePlacements(formData: FormData) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const stageId = String(formData.get("stageId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const back = `/picks?stage=${encodeURIComponent(slug)}`;
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage) bounce(back, "not-found");
  if (player.isDemo && !stage.isDemo) bounce(back, "demo-player");

  const enrolled = await db.select().from(stageTeams).where(eq(stageTeams.stageId, stage.id));
  const allowed = new Set(enrolled.map((row) => row.teamId));
  const series = await db.select({ scheduledAt: matches.scheduledAt }).from(matches).where(eq(matches.stageId, stage.id));
  const firstStart = earliest(
    series.map((row) => row.scheduledAt),
    stage.startsAt,
  );
  if (isLocked(firstStart, new Date())) bounce(back, "locked");

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("picks") ?? "[]"));
  } catch {
    bounce(back, "slate");
  }
  if (!Array.isArray(raw)) bounce(back, "slate");

  const picks: Array<{ teamId: string; slot: Slot }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") bounce(back, "slate");
    const teamId = String((entry as { teamId?: string }).teamId ?? "");
    const slot = String((entry as { slot?: string }).slot ?? "") as Slot;
    if (!SLOTS.has(slot) || !allowed.has(teamId)) bounce(back, "slate");
    picks.push({ teamId, slot });
  }

  const unique = new Set(picks.map((pick) => pick.teamId));
  if (unique.size !== picks.length || picks.length !== 10) bounce(back, "slate");
  for (const slot of Object.keys(SLOT_LIMITS) as Slot[]) {
    if (picks.filter((pick) => pick.slot === slot).length !== SLOT_LIMITS[slot]) bounce(back, "slate");
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(placementPicks)
      .where(and(eq(placementPicks.playerId, player.id), eq(placementPicks.stageId, stage.id)));
    await tx.insert(placementPicks).values(
      picks.map((pick) => ({
        playerId: player.id,
        stageId: stage.id,
        teamId: pick.teamId,
        slot: pick.slot,
      })),
    );
  });

  refresh(stage.slug);
  redirect(`${back}&notice=saved`);
}

export async function saveBracket(stageId: string, incoming: BracketPick[]) {
  const player = await getSessionPlayer();
  if (!player) return { ok: false as const };
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.id, stageId)).limit(1);
  if (!stage || (player.isDemo && !stage.isDemo)) return { ok: false as const };
  const enrolled = await db.select().from(stageTeams).where(eq(stageTeams.stageId, stage.id));
  const series = await db.select().from(matches).where(eq(matches.stageId, stage.id));
  const round1 = series.filter((match) => match.round === 1);
  const first = round1.length
    ? new Date(Math.min(...round1.map((match) => match.scheduledAt.getTime())))
    : stage.startsAt;
  if (isLocked(first, new Date())) return { ok: false as const };
  const teams = enrolled.map((row) => ({ teamId: row.teamId, seed: row.seed }));
  const opening = round1.map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId }));
  const clean = picksFromBracket(projectBracket({ teams, round1: opening, picks: Array.isArray(incoming) ? incoming : [] }));
  await db
    .insert(bracketPicks)
    .values({ playerId: player.id, stageId: stage.id, picks: clean, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [bracketPicks.playerId, bracketPicks.stageId],
      set: { picks: clean, updatedAt: new Date() },
    });
  refresh(stage.slug);
  return { ok: true as const };
}

export async function saveMatchPick(formData: FormData) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const matchId = String(formData.get("matchId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const db = getDb();
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) bounce(`/picks?stage=${encodeURIComponent(slug)}`, "not-found");
  const [stage] = await db.select().from(stages).where(eq(stages.id, match.stageId)).limit(1);
  if (!stage) bounce(`/picks?stage=${encodeURIComponent(slug)}`, "not-found");
  if (player.isDemo && !stage.isDemo) bounce(`/picks?stage=${encodeURIComponent(slug)}`, "demo-player");
  if (isLocked(match.scheduledAt, new Date())) bounce(`/picks?stage=${encodeURIComponent(slug)}`, "locked");

  const clear = String(formData.get("clear") ?? "") === "1";
  if (clear) {
    await db.delete(matchPicks).where(and(eq(matchPicks.playerId, player.id), eq(matchPicks.matchId, match.id)));
    refresh(stage.slug);
    redirect(`/picks?stage=${encodeURIComponent(stage.slug)}&notice=saved#m-${match.id}`);
  }

  const winnerId = String(formData.get("winnerId") ?? "");
  if (winnerId !== match.teamAId && winnerId !== match.teamBId) {
    bounce(`/picks?stage=${encodeURIComponent(stage.slug)}`, "match-teams");
  }

  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (match.format === "bo3") {
    const margin = String(formData.get("margin") ?? "");
    if (margin !== "2-0" && margin !== "2-1") bounce(`/picks?stage=${encodeURIComponent(stage.slug)}`, "match-result");
    const scores = scoresForWinner({
      format: "bo3",
      winnerId,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      margin,
    });
    scoreA = scores.scoreA;
    scoreB = scores.scoreB;
  }

  await db
    .insert(matchPicks)
    .values({
      playerId: player.id,
      matchId: match.id,
      winnerId,
      scoreA,
      scoreB,
    })
    .onConflictDoUpdate({
      target: [matchPicks.playerId, matchPicks.matchId],
      set: { winnerId, scoreA, scoreB, updatedAt: new Date() },
    });

  refresh(stage.slug);
  redirect(`/picks?stage=${encodeURIComponent(stage.slug)}&notice=saved#m-${match.id}`);
}
