import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, getSql } from "@/db";
import { matchOdds, matches, stageTeams, teams } from "@/db/schema";
import { listFixtures, matchOurTeams, winnerPrices } from "./parse";
import { CALLS_PER_REFRESH, DEFAULT_BOOKMAKER, DEFAULT_TOURNAMENT_ID, MONTHLY_REQUEST_BUDGET, STALE_MS } from "./price";

const BASE = "https://api.oddspapi.io/v4";

/**
 * One bet365 tournament call every 6 hours. 24 / 6 × 31 days is about 124
 * requests a month, under the 250 free-tier cap. The gap is last_attempt_at,
 * so a 404 or a name miss still waits 6 hours. Prices are display-only.
 * Pinnacle does not post these fixtures; bet365 is the default book.
 */
export async function maybeRefreshOdds(): Promise<void> {
  if (!process.env.ODDSPAPI_API_KEY) return;
  try {
    if (!(await isStale())) return;
    if (!(await claimLock())) return;
    after(async () => {
      try {
        await pullOdds(process.env.ODDSPAPI_API_KEY!);
      } catch (error) {
        console.error("OddsPapi refresh failed", error);
      } finally {
        await finishAttempt(CALLS_PER_REFRESH);
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
      ) + ${CALLS_PER_REFRESH} <= ${MONTHLY_REQUEST_BUDGET}
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

async function pullOdds(key: string): Promise<void> {
  const tournamentId = process.env.ODDSPAPI_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
  const bookmaker = process.env.ODDSPAPI_BOOKMAKER || DEFAULT_BOOKMAKER;
  const payload = await apiGet(key, "/odds-by-tournaments", {
    bookmaker,
    tournamentIds: tournamentId,
  });
  if (payload == null) {
    console.info("OddsPapi has no lines posted for this tournament.");
    return;
  }
  const wrapped = payload && typeof payload === "object" && Array.isArray((payload as { fixtures?: unknown }).fixtures)
    ? (payload as { fixtures: unknown[] }).fixtures
    : null;
  const fixtures = Array.isArray(payload) ? payload : wrapped ?? [];
  const db = getDb();
  const roster = await db
    .select({ teamId: teams.id, name: teams.name })
    .from(stageTeams)
    .innerJoin(teams, eq(teams.id, stageTeams.teamId));
  const uniqueTeams = [...new Map(roster.map((team) => [team.teamId, team])).values()];
  const series = await db.select().from(matches);
  const manual = new Set(
    (await db.select({ matchId: matchOdds.matchId }).from(matchOdds).where(eq(matchOdds.manual, true))).map((row) => row.matchId),
  );

  for (const row of fixtures) {
    const [fixture] = listFixtures([row]);
    if (!fixture) continue;
    const prices = winnerPrices(row, bookmaker);
    if (!prices) continue;
    const paired = matchOurTeams(fixture, uniqueTeams);
    if (!paired) {
      console.info(`OddsPapi unmatched fixture ${fixture.participant1Name} vs ${fixture.participant2Name}`);
      continue;
    }
    const match = series.find((seriesMatch) => {
      const ids = new Set([seriesMatch.teamAId, seriesMatch.teamBId]);
      return ids.has(paired.team1.teamId) && ids.has(paired.team2.teamId);
    });
    if (!match || manual.has(match.id)) continue;
    const oddsFor = new Map<string, number>([
      [paired.team1.teamId, prices.price1],
      [paired.team2.teamId, prices.price2],
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
