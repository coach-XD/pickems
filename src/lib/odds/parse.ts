import { namesMatch } from "./price";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function suspended(node: Record<string, unknown> | null): boolean {
  if (!node) return false;
  if (node.suspended === true || node.active === false) return true;
  const status = typeof node.status === "string" ? node.status.toLowerCase() : "";
  return status === "suspended" || status === "inactive";
}

/**
 * Match-winner prices from one tournament odds row.
 * Market 171 is the match winner. Outcome 171 is participant 1 and 172 is participant 2.
 * The decimal price is players["0"].price. Missing, inactive, or suspended markets are skipped.
 */
export function winnerPrices(fixture: unknown, bookmaker: string): { price1: number; price2: number } | null {
  const row = asRecord(fixture);
  const books = asRecord(row?.bookmakerOdds);
  const book = asRecord(books?.[bookmaker]);
  if (!book || suspended(book)) return null;
  const markets = asRecord(book.markets);
  const market = asRecord(markets?.["171"]);
  if (!market || suspended(market)) return null;
  const outcomes = asRecord(market.outcomes);
  const price1 = outcomePrice(outcomes?.["171"]);
  const price2 = outcomePrice(outcomes?.["172"]);
  if (price1 == null || price2 == null) return null;
  return { price1, price2 };
}

function outcomePrice(node: unknown): number | null {
  const record = asRecord(node);
  if (!record || suspended(record)) return null;
  const players = asRecord(record.players);
  const slot = players?.["0"];
  const direct = asRecord(slot);
  if (!direct || suspended(direct)) return null;
  return typeof direct.price === "number" && direct.price > 1 ? direct.price : null;
}

export type ListedFixture = {
  fixtureId: string;
  participant1Name: string;
  participant2Name: string;
};

export function listFixtures(payload: unknown): ListedFixture[] {
  const root = asRecord(payload);
  const rows = Array.isArray(payload) ? payload : Array.isArray(root?.fixtures) ? root.fixtures : [];
  return rows.flatMap((row) => {
    const fixture = asRecord(row);
    if (!fixture) return [];
    const fixtureId = String(fixture.fixtureId ?? "");
    const participant1Name = String(fixture.participant1Name ?? "");
    const participant2Name = String(fixture.participant2Name ?? "");
    if (!fixtureId || !participant1Name || !participant2Name) return [];
    return [{ fixtureId, participant1Name, participant2Name }];
  });
}

export function matchOurTeams<T extends { name: string }>(
  fixture: ListedFixture,
  teams: T[],
): { team1: T; team2: T } | null {
  const team1 = teams.find((team) => namesMatch(team.name, fixture.participant1Name));
  const team2 = teams.find((team) => namesMatch(team.name, fixture.participant2Name));
  if (!team1 || !team2 || team1 === team2) return null;
  return { team1, team2 };
}
