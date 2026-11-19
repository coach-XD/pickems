import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, getSql } from "@/db";
import { matchOdds, matches, stageTeams, teams } from "@/db/schema";
import { chooseBookPrice, listFixtures, matchOurTeams } from "./parse";
import { CALLS_PER_REFRESH, DEFAULT_TOURNAMENT_ID, MONTHLY_REQUEST_BUDGET, ODDSPAPI_SPORT_ID, STALE_MS } from "./price";

const BASE = "https://api.oddspapi.io/v4";

/**
 * Request budget: one fixtures call plus one odds call for each of the 8
 * Round 1 matches is 9 HTTP calls. The free tier allows 250 calls a month,
 * so 250 / 9 is about 27 refreshes. The 6 hour gate would allow 120 refreshes
 * if someone kept the site open all month, which would be about 1,080 calls,
 * so the monthly counter below stops a refresh that would cross 250.
 * Pinnacle is used when it posts a two-way price. Otherwise the bookmaker
 * with the smallest overround is stored. Prices are display-only.
 */
export async function maybeRefreshOdds(): Promise<void> {
  if (!process.env.ODDSPAPI_API_KEY) return;
  try {
    if (!(await isStale())) return;
    if (!(await claimLock())) return;
    after(async () => {
      let used = 0;
      try {
        used = await pullOdds(process.env.ODDSPAPI_API_KEY!);
      } catch (error) {
        console.error("OddsPapi refresh failed", error);
      } finally {
        await addUsage(used);
        await releaseLock();
      }
    });
  } catch (error) {
    console.error("Odds refresh check failed", error);
  }
}

async function isStale(): Promise<boolean> {
  const [row] = await getSql()`
    select max(fetched_at) as fetched_at from match_odds where manual = false
  `;
  const fetched = row?.fetched_at ? new Date(row.fetched_at as string | Date) : null;
  if (!fetched || Number.isNaN(fetched.getTime())) return true;
  return Date.now() - fetched.getTime() >= STALE_MS;
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

async function addUsage(count: number): Promise<void> {
  if (count <= 0) return;
  await getSql()`update odds_fetch_lock set request_count = request_count + ${count} where id = 1`;
}

async function releaseLock(): Promise<void> {
  await getSql()`update odds_fetch_lock set locked_until = '1970-01-01' where id = 1`;
}

async function apiGet(key: string, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`OddsPapi ${path} returned ${response.status}`);
  return response.json();
}

async function pullOdds(key: string): Promise<number> {
  const tournamentId = process.env.ODDSPAPI_TOURNAMENT_ID || DEFAULT_TOURNAMENT_ID;
  const fixturesPayload = await apiGet(key, "/fixtures", {
    sportId: String(ODDSPAPI_SPORT_ID),
    tournamentId,
    from: "2026-11-20",
    to: "2026-12-20",
  });
  let calls = 1;
  const fixtures = listFixtures(fixturesPayload);
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

  for (const fixture of fixtures) {
    const paired = matchOurTeams(fixture, uniqueTeams);
    if (!paired) {
      console.info(`OddsPapi unmatched fixture ${fixture.participant1Name} vs ${fixture.participant2Name}`);
      continue;
    }
    const match = series.find((row) => {
      const ids = new Set([row.teamAId, row.teamBId]);
      return ids.has(paired.team1.teamId) && ids.has(paired.team2.teamId);
    });
    if (!match || manual.has(match.id)) continue;
    const oddsPayload = await apiGet(key, "/odds", { fixtureId: fixture.fixtureId, bookmakers: "pinnacle" });
    calls += 1;
    const book = chooseBookPrice(oddsPayload);
    if (!book) {
      console.info(`OddsPapi no two-way price for ${fixture.participant1Name} vs ${fixture.participant2Name}`);
      continue;
    }
    const price1 = book.rotated ? book.price2 : book.price1;
    const price2 = book.rotated ? book.price1 : book.price2;
    const oddsFor = new Map<string, number>([
      [paired.team1.teamId, price1],
      [paired.team2.teamId, price2],
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
        bookmaker: book.bookmaker,
        source: "oddspapi",
        manual: false,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: matchOdds.matchId,
        set: {
          team1Odds,
          team2Odds,
          bookmaker: book.bookmaker,
          source: "oddspapi",
          manual: false,
          fetchedAt: new Date(),
        },
      });
  }
  return calls;
}
