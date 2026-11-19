import { namesMatch } from "./price";

export type FixtureSide = { name: string };
export type BookPrice = { bookmaker: string; price1: number; price2: number; rotated: boolean };

const WINNER_MARKETS = new Set(["171", "178077", "1"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function priceOf(node: unknown): number | null {
  const record = asRecord(node);
  if (!record) return null;
  if (typeof record.price === "number" && record.price > 1) return record.price;
  const players = asRecord(record.players);
  const slot = players?.["0"];
  if (Array.isArray(slot)) {
    const snaps = slot.filter((item) => {
      const row = asRecord(item);
      return row && row.active !== false && typeof row.price === "number" && row.price > 1;
    });
    const last = snaps.at(-1);
    const price = asRecord(last)?.price;
    return typeof price === "number" ? price : null;
  }
  const direct = asRecord(slot);
  if (direct && typeof direct.price === "number" && direct.price > 1) return direct.price;
  return null;
}

function twoPrices(market: unknown): [number, number] | null {
  const record = asRecord(market);
  const outcomes = asRecord(record?.outcomes) ?? record;
  if (!outcomes) return null;
  const prices = Object.values(outcomes)
    .map((outcome) => priceOf(outcome))
    .filter((price): price is number => price != null);
  if (prices.length !== 2) return null;
  return [prices[0], prices[1]];
}

function booksOf(payload: unknown): Record<string, unknown> {
  const root = asRecord(payload) ?? {};
  return asRecord(root.bookmakers) ?? asRecord(root.bookmakerOdds) ?? root;
}

/** Pinnacle's two-way price when it exists, otherwise the book with the smallest overround. */
export function chooseBookPrice(payload: unknown): BookPrice | null {
  const books = booksOf(payload);
  const parsed: BookPrice[] = [];
  for (const [slug, node] of Object.entries(books)) {
    const book = asRecord(node);
    if (!book) continue;
    const markets = asRecord(book.markets) ?? book;
    let chosen: [number, number] | null = null;
    for (const id of WINNER_MARKETS) {
      const prices = twoPrices(markets[id]);
      if (prices) {
        chosen = prices;
        break;
      }
    }
    if (!chosen) {
      for (const market of Object.values(markets)) {
        const prices = twoPrices(market);
        if (prices) {
          chosen = prices;
          break;
        }
      }
    }
    if (!chosen) continue;
    parsed.push({
      bookmaker: slug,
      price1: chosen[0],
      price2: chosen[1],
      rotated: book.participantsRotated === true,
    });
  }
  const pinnacle = parsed.find((book) => book.bookmaker.toLowerCase() === "pinnacle");
  if (pinnacle) return pinnacle;
  return parsed.sort((a, b) => overround(a) - overround(b))[0] ?? null;
}

function overround(book: BookPrice): number {
  return 1 / book.price1 + 1 / book.price2;
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
