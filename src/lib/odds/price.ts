/** Shrink VRS gaps. Valve points overrate favorites in a single Bo1. */
export const VRS_ELO_SHRINK = 0.6;

/** Fake book margin baked into a projected decimal price. */
export const PROJECTED_MARGIN = 1.05;

export const ODDSPAPI_SPORT_ID = 17;
export const DEFAULT_TOURNAMENT_ID = "51216";

/**
 * One tournament odds call every 6 hours. 24 / 6 × 31 days is about 124
 * requests a month, under the free-tier cap of 250.
 */
export const CALLS_PER_REFRESH = 1;
export const DEFAULT_BOOKMAKER = "bet365";
export const MONTHLY_REQUEST_BUDGET = 250;
export const STALE_MS = 6 * 60 * 60 * 1000;

/**
 * Fair win chance for the team with `points`, against `opponent`.
 * p = 1 / (1 + 10^(-(shrink * diff) / 400)).
 */
export function eloWinProbability(points: number, opponent: number, shrink = VRS_ELO_SHRINK): number {
  const diff = points - opponent;
  return 1 / (1 + 10 ** ((-shrink * diff) / 400));
}

/** Decimal price with the fake margin. Fair percent is the Elo chance, margin removed. */
export function projectedPrice(points: number, opponent: number): { odds: number; percent: number } {
  const fair = eloWinProbability(points, opponent);
  const odds = Math.round((1 / (fair * PROJECTED_MARGIN)) * 100) / 100;
  return { odds, percent: Math.round(fair * 100) };
}

/** Remove the book overround so the two sides sum to 100. */
export function fairPercents(oddsA: number, oddsB: number): { a: number; b: number } {
  const rawA = 1 / oddsA;
  const rawB = 1 / oddsB;
  const sum = rawA + rawB;
  return { a: Math.round((rawA / sum) * 100), b: Math.round((rawB / sum) * 100) };
}

export function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const STRIP_TOKENS = ["esports", "gaming", "clan", "team", "gg", "cs"];

/** Drop bookmaker suffixes and prefixes such as "eSports", "Gaming", and "Team". */
export function coreTeamName(name: string): string {
  let current = normalizeTeamName(name);
  let changed = true;
  while (changed && current.length > 0) {
    changed = false;
    for (const token of STRIP_TOKENS) {
      if (current.length <= token.length) continue;
      if (current.endsWith(token)) {
        current = current.slice(0, -token.length);
        changed = true;
      } else if (current.startsWith(token)) {
        current = current.slice(token.length);
        changed = true;
      }
    }
  }
  return current;
}

const ALIASES: Record<string, string[]> = {
  bcgamegosh: ["gosh", "bcgame", "bc.game"],
  parivision: ["pvision"],
  ninjasinpyjamas: ["nip"],
  "100thieves": ["100t"],
};

export function displayOdds(input: {
  pointsA: number | null | undefined;
  pointsB: number | null | undefined;
  realA?: number | null;
  realB?: number | null;
}): { oddsA: number; oddsB: number; percentA: number; percentB: number; projected: boolean } | null {
  if (input.realA != null && input.realB != null && input.realA > 1 && input.realB > 1) {
    const fair = fairPercents(input.realA, input.realB);
    return { oddsA: input.realA, oddsB: input.realB, percentA: fair.a, percentB: fair.b, projected: false };
  }
  if (input.pointsA == null || input.pointsB == null) return null;
  const left = projectedPrice(input.pointsA, input.pointsB);
  const right = projectedPrice(input.pointsB, input.pointsA);
  return { oddsA: left.odds, oddsB: right.odds, percentA: left.percent, percentB: right.percent, projected: true };
}

export function namesMatch(ourName: string, externalName: string): boolean {
  const ours = coreTeamName(ourName);
  const external = coreTeamName(externalName);
  if (!ours || !external) return false;
  if (ours === external) return true;
  const aliases = ALIASES[ours] ?? [];
  return aliases.some((alias) => coreTeamName(alias) === external || normalizeTeamName(alias) === external);
}
