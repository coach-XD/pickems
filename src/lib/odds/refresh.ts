import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, getSql } from "@/db";
import { matchOdds, matches, stages, teams } from "@/db/schema";
import { listFixtureParticipants, listOddsRows, mapParticipants, winnerPrices } from "./parse";
import {
  DEFAULT_BOOKMAKER,
  DEFAULT_TOURNAMENT_ID,
  MAX_CALLS_PER_REFRESH,
  MONTHLY_REQUEST_BUDGET,
  ODDSPAPI_SPORT_ID,
  STALE_MS,
  stageUsesLiveOdds,
} from "./price";

const BASE = "https://api.oddspapi.io/v4";

function rowCouldBeLive(
  rows: Array<{ participant1Id: number; participant2Id: number }>,
  participantId: number,
  mapping: Map<number, { id: string }>,
  liveTeamIds: Set<string>,
): boolean {
  return rows.some((row) => {
    const ids = [row.participant1Id, row.participant2Id];
    if (!ids.includes(participantId)) return false;
    const otherId = ids[0] === participantId ? ids[1] : ids[0];
    const other = mapping.get(otherId);
    if (!other) return true;
    return liveTeamIds.has(other.id);
  });
}

/**
 * One unibet tournament call every 6 hours, about 124 requests a month.
 * /fixtures is a second call, and only while a participant id is unmapped.
 * The counter stores the calls actually made. A 404 is no lines, and
 * last_attempt_at still moves so an empty refresh waits 6 hours.
 * The bookmaker query accepts exactly one book. Prices are display-only.
 */
export async function maybeRefreshOdds(stageSlug?: string): Promise<void> {
  if (stageSlug && !stageUsesLiveOdds(stageSlug)) return;
  if (!process.env.ODDSPAPI_API_KEY) return;
  try {
    if (!(await isStale())) return;
    if (!(await claimLock())) return;
    after(async () => {
      const usage = { calls: 0 };
      try {
        await pullOdds(process.env.ODDSPAPI_API_KEY!, usage);
      } catch (error) {
        console.error("OddsPapi refresh failed", error);
      } finally {
        await finishAttempt(usage.calls);
      }
    });
  } catch (error) {
    console.error("Odds refresh check failed", error);
  }
}

async function isStale(): Promise<boolean> {
  const [row] = await getSql()`select last_attempt_at from odds_fetch_lock where id = 1`;
  const attempted = row?.last_attempt_at ? new Date(row.last_attempt_at as string | Date) : null;
  if (!attempted || Number.isNaN(attempted.getTime())) return true;
  return Date.now() - attempted.getTime() >= STALE_MS;
}

async function claimLock(): Promise<boolean> {
  const rows = await getSql()`
    update odds_fetch_lock
    set locked_until = now() + interval '3 minutes',
        month_key = to_char(now() at time zone 'utc', 'YYYY-MM'),
        request_count = case
          when month_key = to_char(now() at time zone 'utc', 'YYYY-MM') then request_count
          else 0
        end
    where id = 1
      and locked_until < now()
      and (
        case
          when month_key = to_char(now() at time zone 'utc', 'YYYY-MM') then request_count
          else 0
        end
      ) + ${MAX_CALLS_PER_REFRESH} <= ${MONTHLY_REQUEST_BUDGET}
    returning id
  `;
  return rows.length > 0;
}

async function finishAttempt(count: number): Promise<void> {
  await getSql()`
    update odds_fetch_lock
    set locked_until = '1970-01-01',
        last_attempt_at = now(),
        request_count = request_count + ${count}
    where id = 1
  `;
}

async function apiGet(key: string, path: string, params: Record<string, string>): Promise<unknown | null> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OddsPapi ${path} returned ${response.status}`);
  return response.json();
}

async function pullOdds(key: string, usage: { calls: number }): Promise<void> {
  const tournamentId = process.env.ODDSPAPI_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
  const bookmaker = process.env.ODDSPAPI_BOOKMAKER || DEFAULT_BOOKMAKER;
  usage.calls += 1;
  const payload = await apiGet(key, "/odds-by-tournaments", {
    bookmaker,
    tournamentIds: tournamentId,
  });
  if (payload == null) {
    console.info("OddsPapi has no lines posted for this tournament.");
    return;
  }
  const rows = listOddsRows(payload);
  const db = getDb();
  const stageRows = await db.select({ id: stages.id, slug: stages.slug }).from(stages);
  const liveStageIds = new Set(stageRows.filter((stage) => stageUsesLiveOdds(stage.slug)).map((stage) => stage.id));
  const roster = await db
    .select({ id: teams.id, name: teams.name, oddspapiId: teams.oddspapiId })
    .from(teams);
  const mapping = new Map(roster.flatMap((team) => (team.oddspapiId == null ? [] : [[team.oddspapiId, team] as const])));
  const series = await db.select().from(matches);
  const liveTeamIds = new Set<string>();
  for (const match of series) {
    if (!liveStageIds.has(match.stageId)) continue;
    liveTeamIds.add(match.teamAId);
    liveTeamIds.add(match.teamBId);
  }
  const needed = new Set(rows.flatMap((row) => [row.participant1Id, row.participant2Id]));
  const missing = [...needed].filter((id) => !mapping.has(id) && rowCouldBeLive(rows, id, mapping, liveTeamIds));
  if (missing.length > 0) {
    usage.calls += 1;
    const fixturesPayload = await apiGet(key, "/fixtures", {
      sportId: String(ODDSPAPI_SPORT_ID),
      tournamentId,
    });
    if (fixturesPayload == null) {
      console.info("OddsPapi fixtures are not posted for this tournament.");
    } else {
      const discovered = mapParticipants(listFixtureParticipants(fixturesPayload), roster);
      for (const [participantId, team] of discovered) {
        if (team.oddspapiId != null || mapping.has(participantId)) continue;
        await db.update(teams).set({ oddspapiId: participantId }).where(eq(teams.id, team.id));
        mapping.set(participantId, { ...team, oddspapiId: participantId });
      }
    }
  }

  const manual = new Set(
    (await db.select({ matchId: matchOdds.matchId }).from(matchOdds).where(eq(matchOdds.manual, true))).map((row) => row.matchId),
  );
  for (const row of rows) {
    const prices = winnerPrices(row.raw, bookmaker);
    const side1 = mapping.get(row.participant1Id);
    const side2 = mapping.get(row.participant2Id);
    if (!prices || !side1 || !side2) {
      if (!side1 || !side2) console.info(`OddsPapi unmatched participant ids ${row.participant1Id} vs ${row.participant2Id}`);
      continue;
    }
    const match = series.find((seriesMatch) => {
      const ids = new Set([seriesMatch.teamAId, seriesMatch.teamBId]);
      return ids.has(side1.id) && ids.has(side2.id);
    });
    if (!match || !liveStageIds.has(match.stageId) || manual.has(match.id)) continue;
    const oddsFor = new Map<string, number>([
      [side1.id, prices.price1],
      [side2.id, prices.price2],
    ]);
    const team1Odds = oddsFor.get(match.teamAId);
    const team2Odds = oddsFor.get(match.teamBId);
    if (team1Odds == null || team2Odds == null) continue;
    await db
      .insert(matchOdds)
      .values({
        matchId: match.id,
        team1Odds,
        team2Odds,
        bookmaker,
        source: "oddspapi",
        manual: false,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: matchOdds.matchId,
        set: { team1Odds, team2Odds, bookmaker, source: "oddspapi", manual: false, fetchedAt: new Date() },
      });
  }
}
