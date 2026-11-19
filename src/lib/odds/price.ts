/** Shrink VRS gaps. Valve points overrate favorites in a single Bo1. */
export const VRS_ELO_SHRINK = 0.6;

/** Fake book margin baked into a projected decimal price. */
export const PROJECTED_MARGIN = 1.05;

export const ODDSPAPI_SPORT_ID = 17;
export const DEFAULT_TOURNAMENT_ID = "51216";

/** One fixtures call plus one odds call per Round 1 match. */
export const CALLS_PER_REFRESH = 9;
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

const ALIASES: Record<string, string[]> = {
  bcgamegosh: ["gosh", "bcgame", "bc.game", "bc game"],
  parivision: ["pvision", "pari"],
  "100thieves": ["100t", "100 thieves"],
  ninjasinpyjamas: ["nip", "ninjas in pyjamas"],
  heroic: ["heroic"],
  faze: ["faze"],
  liquid: ["liquid", "team liquid"],
  eternalfire: ["eternal fire", "eternalfire"],
  "9z": ["9z"],
  m80: ["m80"],
  dendele: ["dendele"],
  imperial: ["imperial"],
  wildcard: ["wildcard"],
  flyquest: ["flyquest"],
  chinggiswarriors: ["chinggis warriors", "chinggis"],
  lynnvision: ["lynn vision", "lynnvision"],
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
  const ours = normalizeTeamName(ourName);
  const external = normalizeTeamName(externalName);
  if (!ours || !external) return false;
  if (ours === external) return true;
  const aliases = ALIASES[ours] ?? [];
  return aliases.some((alias) => normalizeTeamName(alias) === external);
}
