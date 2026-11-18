import type { SeriesFormat, TeamStatus } from "./types";

export type SimTeam = { teamId: string; seed: number };

export type Standing = {
  teamId: string;
  seed: number;
  wins: number;
  losses: number;
  status: TeamStatus;
};

export type PlayedMatch = {
  round: number;
  scheduledAt?: Date | string | null;
  teamAId: string;
  teamBId: string;
  winnerId: string | null;
};

export type SimulatedMatch = {
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId: string;
  format: SeriesFormat;
  scoreA: number;
  scoreB: number;
};

export type PairSuggestion = {
  teamAId: string;
  teamBId: string;
  wins: number;
  losses: number;
  record: string;
  format: SeriesFormat;
  rematch: boolean;
};

export function teamStatus(wins: number, losses: number): TeamStatus {
  if (wins >= 3) return "advanced";
  if (losses >= 3) return "eliminated";
  return "active";
}

/** Advancement and elimination series are Bo3. Everything else is Bo1. */
export function seriesFormat(wins: number, losses: number): SeriesFormat {
  if (wins >= 2 || losses >= 2) return "bo3";
  return "bo1";
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function timeValue(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Wins and losses come only from completed matches, in round order.
 * A result is ignored once either team has already advanced or been eliminated,
 * so a late extra series cannot rewrite a finished record.
 */
export function deriveStandings(teams: SimTeam[], matches: PlayedMatch[]): Standing[] {
  const state = new Map(teams.map((team) => [team.teamId, { seed: team.seed, wins: 0, losses: 0 }]));
  const ordered = matches
    .map((match, index) => ({ match, index }))
    .sort((a, b) => {
      if (a.match.round !== b.match.round) return a.match.round - b.match.round;
      const delta = timeValue(a.match.scheduledAt) - timeValue(b.match.scheduledAt);
      if (delta !== 0) return delta;
      return a.index - b.index;
    });

  for (const { match } of ordered) {
    if (!match.winnerId) continue;
    if (match.winnerId !== match.teamAId && match.winnerId !== match.teamBId) continue;
    const sideA = state.get(match.teamAId);
    const sideB = state.get(match.teamBId);
    if (!sideA || !sideB) continue;
    if (teamStatus(sideA.wins, sideA.losses) !== "active") continue;
    if (teamStatus(sideB.wins, sideB.losses) !== "active") continue;
    if (match.winnerId === match.teamAId) {
      sideA.wins += 1;
      sideB.losses += 1;
    } else {
      sideB.wins += 1;
      sideA.losses += 1;
    }
  }

  return [...state.entries()].map(([teamId, row]) => ({
    teamId,
    seed: row.seed,
    wins: row.wins,
    losses: row.losses,
    status: teamStatus(row.wins, row.losses),
  }));
}

export function groupByRecord<T extends { wins: number; losses: number; status: TeamStatus; seed: number }>(
  rows: T[],
): {
  advanced: Array<{ record: string; teams: T[] }>;
  active: Array<{ record: string; teams: T[] }>;
  eliminated: Array<{ record: string; teams: T[] }>;
} {
  const buckets = (list: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of list) {
      const key = `${row.wins}-${row.losses}`;
      const group = map.get(key) ?? [];
      group.push(row);
      map.set(key, group);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        const [aw, al] = a.split("-").map(Number);
        const [bw, bl] = b.split("-").map(Number);
        if (bw !== aw) return bw - aw;
        return al - bl;
      })
      .map(([record, teams]) => ({
        record,
        teams: teams.slice().sort((a, b) => a.seed - b.seed),
      }));
  };

  return {
    advanced: buckets(rows.filter((row) => row.status === "advanced")),
    active: buckets(rows.filter((row) => row.status === "active")),
    eliminated: buckets(rows.filter((row) => row.status === "eliminated")),
  };
}

/**
 * Pair each active record pool high-seed vs low-seed, skipping rematches when
 * another opponent is free. The admin confirms or edits before anything is saved.
 */
export function suggestPairings(
  standings: Standing[],
  played: Array<[string, string]>,
): { pairs: PairSuggestion[]; leftovers: string[] } {
  const playedSet = new Set(played.map(([a, b]) => pairKey(a, b)));
  const active = standings.filter((row) => row.status === "active");
  const groups = new Map<string, Standing[]>();
  for (const team of active) {
    const key = `${team.wins}-${team.losses}`;
    const list = groups.get(key) ?? [];
    list.push(team);
    groups.set(key, list);
  }

  const keys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    if (bw !== aw) return bw - aw;
    return al - bl;
  });

  const pairs: PairSuggestion[] = [];
  const leftovers: string[] = [];

  for (const key of keys) {
    const pool = groups.get(key)!.slice().sort((a, b) => a.seed - b.seed);
    const used = new Set<string>();
    for (const team of pool) {
      if (used.has(team.teamId)) continue;
      const candidates = pool
        .filter((other) => other.teamId !== team.teamId && !used.has(other.teamId))
        .sort((a, b) => b.seed - a.seed);
      if (candidates.length === 0) {
        leftovers.push(team.teamId);
        used.add(team.teamId);
        continue;
      }
      const fresh = candidates.find((other) => !playedSet.has(pairKey(team.teamId, other.teamId)));
      const opponent = fresh ?? candidates[0];
      used.add(team.teamId);
      used.add(opponent.teamId);
      const [teamA, teamB] = team.seed <= opponent.seed ? [team, opponent] : [opponent, team];
      pairs.push({
        teamAId: teamA.teamId,
        teamBId: teamB.teamId,
        wins: team.wins,
        losses: team.losses,
        record: key,
        format: seriesFormat(team.wins, team.losses),
        rematch: !fresh,
      });
    }
  }

  return { pairs, leftovers };
}

/**
 * Chalk Swiss: inside each record pool the better seed always beats the worse
 * seed. Used by the optional demo stage and by the distribution test.
 */
export function simulateChalkSwiss(teams: SimTeam[]): SimulatedMatch[] {
  const state = new Map(teams.map((team) => [team.teamId, { wins: 0, losses: 0, seed: team.seed }]));
  const matches: SimulatedMatch[] = [];
  let bo3Count = 0;

  for (let round = 1; round <= 5; round += 1) {
    const active = [...state.entries()]
      .filter(([, row]) => row.wins < 3 && row.losses < 3)
      .map(([teamId, row]) => ({ teamId, ...row }));
    if (active.length === 0) break;

    const groups = new Map<string, typeof active>();
    for (const team of active) {
      const key = `${team.wins}-${team.losses}`;
      const list = groups.get(key) ?? [];
      list.push(team);
      groups.set(key, list);
    }

    for (const key of [...groups.keys()].sort()) {
      const pool = groups.get(key)!.slice().sort((a, b) => a.seed - b.seed);
      if (pool.length % 2 !== 0) {
        throw new Error(`Odd record pool in round ${round} (${key}).`);
      }
      const half = pool.length / 2;
      for (let index = 0; index < half; index += 1) {
        const better = pool[index];
        const worse = pool[pool.length - 1 - index];
        const format = seriesFormat(better.wins, better.losses);
        let scoreA = 1;
        let scoreB = 0;
        if (format === "bo3") {
          scoreA = 2;
          scoreB = bo3Count % 2 === 0 ? 0 : 1;
          bo3Count += 1;
        }
        matches.push({
          round,
          teamAId: better.teamId,
          teamBId: worse.teamId,
          winnerId: better.teamId,
          format,
          scoreA,
          scoreB,
        });
        state.get(better.teamId)!.wins += 1;
        state.get(worse.teamId)!.losses += 1;
      }
    }
  }

  return matches;
}
