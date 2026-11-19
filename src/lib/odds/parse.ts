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

export type OddsRow = {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  raw: unknown;
};

export type NamedParticipant = {
  participantId: number;
  name: string;
};

function numberId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function rowsOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (Array.isArray(root?.fixtures)) return root.fixtures;
  return [];
}

/**
 * Tournament odds rows have participant ids and no names.
 * Names come from /fixtures and are stored as teams.oddspapi_id.
 */
export function listOddsRows(payload: unknown): OddsRow[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((row) => {
    const fixture = asRecord(row);
    if (!fixture) return [];
    const participant1Id = numberId(fixture.participant1Id);
    const participant2Id = numberId(fixture.participant2Id);
    if (participant1Id == null || participant2Id == null) return [];
    return [{ fixtureId: String(fixture.fixtureId ?? ""), participant1Id, participant2Id, raw: row }];
  });
}

/** Participant ids and names from a /fixtures payload. */
export function listFixtureParticipants(payload: unknown): NamedParticipant[] {
  const found = new Map<number, string>();
  for (const row of rowsOf(payload)) {
    const fixture = asRecord(row);
    if (!fixture) continue;
    const sides = [
      [fixture.participant1Id, fixture.participant1Name],
      [fixture.participant2Id, fixture.participant2Name],
    ] as const;
    for (const [idValue, nameValue] of sides) {
      const participantId = numberId(idValue);
      const name = typeof nameValue === "string" ? nameValue.trim() : "";
      if (participantId == null || !name || found.has(participantId)) continue;
      found.set(participantId, name);
    }
  }
  return [...found].map(([participantId, name]) => ({ participantId, name }));
}

/** Name-match fixture participants onto our teams. One team keeps one participant id. */
export function mapParticipants<T extends { id: string; name: string }>(
  participants: NamedParticipant[],
  teams: T[],
): Map<number, T> {
  const byParticipant = new Map<number, T>();
  const usedTeams = new Set<string>();
  for (const participant of participants) {
    if (byParticipant.has(participant.participantId)) continue;
    const team = teams.find((candidate) => !usedTeams.has(candidate.id) && namesMatch(candidate.name, participant.name));
    if (!team) continue;
    byParticipant.set(participant.participantId, team);
    usedTeams.add(team.id);
  }
  return byParticipant;
}

export type PricedFixture<T> = {
  fixtureId: string;
  team1: T;
  team2: T;
  price1: number;
  price2: number;
};

/** Apply a saved participant-id map to odds rows that do not carry names. */
export function priceMappedFixtures<T extends { id: string; name: string }>(
  oddsPayload: unknown,
  bookmaker: string,
  mapping: Map<number, T>,
): PricedFixture<T>[] {
  const priced: PricedFixture<T>[] = [];
  for (const row of listOddsRows(oddsPayload)) {
    const prices = winnerPrices(row.raw, bookmaker);
    const team1 = mapping.get(row.participant1Id);
    const team2 = mapping.get(row.participant2Id);
    if (!prices || !team1 || !team2 || team1.id === team2.id) continue;
    priced.push({ fixtureId: row.fixtureId, team1, team2, price1: prices.price1, price2: prices.price2 });
  }
  return priced;
}

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
