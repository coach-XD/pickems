import { pairKey, seriesFormat, teamStatus } from "./swiss";
import type { SeriesFormat } from "./types";

/**
 * Valve CS Major supplemental rulebook (matchmaking), as published at
 * https://github.com/ValveSoftware/counter-strike_rules_and_regs
 *
 * Round 1 is fixed: 1 vs 9, 2 vs 10, … 8 vs 16.
 * After that, seed within a record is Buchholz difficulty (sum of each
 * opponent's current wins minus their current losses), then initial seed.
 * Higher difficulty is the better seed. A lower initial seed number is better.
 * Rounds 2 and 3 pair the best seed with the worst available seed, avoiding
 * rematches, and backtrack if that greedy choice cannot finish the pool.
 * Later rounds with six teams use Valve's 15-row priority table, which is
 * every perfect matching of six teams. The first row with no rematch wins.
 * If every row rematches, the earliest row with the fewest rematches is used.
 * Advancement and elimination matches are Bo3. The rest are Bo1.
 */

export type SeededTeam = { teamId: string; seed: number };

export type ValvePair = {
  teamAId: string;
  teamBId: string;
  wins: number;
  losses: number;
  format: SeriesFormat;
  rematch: boolean;
};

const PRIORITY_TABLE: Array<Array<[number, number]>> = [
  [[1, 6], [2, 5], [3, 4]],
  [[1, 6], [2, 4], [3, 5]],
  [[1, 5], [2, 6], [3, 4]],
  [[1, 5], [2, 4], [3, 6]],
  [[1, 4], [2, 6], [3, 5]],
  [[1, 4], [2, 5], [3, 6]],
  [[1, 6], [2, 3], [4, 5]],
  [[1, 5], [2, 3], [4, 6]],
  [[1, 3], [2, 6], [4, 5]],
  [[1, 3], [2, 5], [4, 6]],
  [[1, 4], [2, 3], [5, 6]],
  [[1, 3], [2, 4], [5, 6]],
  [[1, 2], [3, 6], [4, 5]],
  [[1, 2], [3, 5], [4, 6]],
  [[1, 2], [3, 4], [5, 6]],
];

export function difficultyScore(opponents: Array<{ wins: number; losses: number }>): number {
  return opponents.reduce((sum, opponent) => sum + opponent.wins - opponent.losses, 0);
}

export function initialSwissPairs(teams: SeededTeam[]): Array<{ teamAId: string; teamBId: string }> {
  const ranked = [...teams].sort((a, b) => a.seed - b.seed || a.teamId.localeCompare(b.teamId));
  const half = Math.floor(ranked.length / 2);
  const pairs = [];
  for (let index = 0; index < half; index += 1) {
    pairs.push({ teamAId: ranked[index].teamId, teamBId: ranked[index + half].teamId });
  }
  return pairs;
}

type PoolTeam = SeededTeam & { wins: number; losses: number; buchholz: number };

function bySeed(a: PoolTeam, b: PoolTeam): number {
  if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
  if (a.seed !== b.seed) return a.seed - b.seed;
  return a.teamId.localeCompare(b.teamId);
}

function pairSix(ranked: PoolTeam[], played: Set<string>): Array<[PoolTeam, PoolTeam]> {
  let fallback: { rematches: number; pairs: Array<[PoolTeam, PoolTeam]> } | null = null;
  for (const row of PRIORITY_TABLE) {
    const pairs = row.map(([left, right]) => [ranked[left - 1], ranked[right - 1]] as [PoolTeam, PoolTeam]);
    const rematches = pairs.filter(([a, b]) => played.has(pairKey(a.teamId, b.teamId))).length;
    if (rematches === 0) return pairs;
    if (!fallback || rematches < fallback.rematches) fallback = { rematches, pairs };
  }
  return fallback?.pairs ?? [];
}

/**
 * Minimum-rematch perfect matching. Among those, the best seed faces the
 * worst seed it can, then the next best seed does the same.
 */
function pairBySearch(ranked: PoolTeam[], played: Set<string>): Array<[PoolTeam, PoolTeam]> {
  const count = ranked.length;
  const used = Array<boolean>(count).fill(false);
  const found: { best: { rematches: number; signature: number[]; pairs: Array<[number, number]> } | null } = { best: null };

  function better(signature: number[], rematches: number): boolean {
    const best = found.best;
    if (!best) return true;
    if (rematches !== best.rematches) return rematches < best.rematches;
    for (let index = 0; index < signature.length; index += 1) {
      if (signature[index] !== best.signature[index]) return signature[index] > best.signature[index];
    }
    return false;
  }

  function dfs(rematches: number, pairs: Array<[number, number]>) {
    if (found.best && rematches > found.best.rematches) return;
    let home = 0;
    while (home < count && used[home]) home += 1;
    if (home >= count) {
      const signature = Array<number>(count).fill(-1);
      for (const [left, right] of pairs) {
        signature[left] = right;
        signature[right] = left;
      }
      if (better(signature, rematches)) found.best = { rematches, signature, pairs: pairs.map((pair) => [pair[0], pair[1]] as [number, number]) };
      return;
    }
    used[home] = true;
    for (let away = count - 1; away >= 0; away -= 1) {
      if (away === home || used[away]) continue;
      const extra = played.has(pairKey(ranked[home].teamId, ranked[away].teamId)) ? 1 : 0;
      if (found.best && rematches + extra > found.best.rematches) continue;
      used[away] = true;
      pairs.push([home, away]);
      dfs(rematches + extra, pairs);
      pairs.pop();
      used[away] = false;
    }
    used[home] = false;
  }

  dfs(0, []);
  return (found.best?.pairs ?? []).map(([home, away]) => [ranked[home], ranked[away]]);
}

export function pairRecordPool(round: number, pool: PoolTeam[], played: Set<string>): ValvePair[] {
  const ranked = [...pool].sort(bySeed);
  if (ranked.length < 2) return [];
  const matched = round >= 4 && ranked.length === 6 ? pairSix(ranked, played) : pairBySearch(ranked, played);
  return matched.map(([teamA, teamB]) => ({
    teamAId: teamA.teamId,
    teamBId: teamB.teamId,
    wins: teamA.wins,
    losses: teamA.losses,
    format: seriesFormat(teamA.wins, teamA.losses),
    rematch: played.has(pairKey(teamA.teamId, teamB.teamId)),
  }));
}

export type CompletedSeries = {
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId: string;
};

type LiveTeam = {
  teamId: string;
  seed: number;
  wins: number;
  losses: number;
  opponents: string[];
};

function liveTable(teams: SeededTeam[]): Map<string, LiveTeam> {
  return new Map(teams.map((team) => [team.teamId, { ...team, wins: 0, losses: 0, opponents: [] }]));
}

function applyResult(table: Map<string, LiveTeam>, match: CompletedSeries) {
  const sideA = table.get(match.teamAId);
  const sideB = table.get(match.teamBId);
  if (!sideA || !sideB) return;
  if (teamStatus(sideA.wins, sideA.losses) !== "active") return;
  if (teamStatus(sideB.wins, sideB.losses) !== "active") return;
  if (match.winnerId !== match.teamAId && match.winnerId !== match.teamBId) return;
  if (match.winnerId === match.teamAId) {
    sideA.wins += 1;
    sideB.losses += 1;
  } else {
    sideB.wins += 1;
    sideA.losses += 1;
  }
  sideA.opponents.push(sideB.teamId);
  sideB.opponents.push(sideA.teamId);
}

function buchholz(table: Map<string, LiveTeam>, teamId: string): number {
  const team = table.get(teamId);
  if (!team) return 0;
  return difficultyScore(team.opponents.map((opponentId) => table.get(opponentId)!));
}

export function pairNextRound(input: {
  teams: SeededTeam[];
  completed: CompletedSeries[];
  round: number;
}): ValvePair[] {
  if (input.round <= 1) {
    return initialSwissPairs(input.teams).map((pair) => ({
      ...pair,
      wins: 0,
      losses: 0,
      format: "bo1" as const,
      rematch: false,
    }));
  }
  const table = liveTable(input.teams);
  const ordered = [...input.completed].sort((a, b) => a.round - b.round);
  const played = new Set<string>();
  for (const match of ordered) {
    if (match.round >= input.round) continue;
    applyResult(table, match);
    played.add(pairKey(match.teamAId, match.teamBId));
  }
  const active = [...table.values()].filter((team) => teamStatus(team.wins, team.losses) === "active");
  const groups = new Map<string, PoolTeam[]>();
  for (const team of active) {
    const key = `${team.wins}-${team.losses}`;
    const list = groups.get(key) ?? [];
    list.push({
      teamId: team.teamId,
      seed: team.seed,
      wins: team.wins,
      losses: team.losses,
      buchholz: buchholz(table, team.teamId),
    });
    groups.set(key, list);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    if (bw !== aw) return bw - aw;
    return al - bl;
  });
  return keys.flatMap((key) => pairRecordPool(input.round, groups.get(key)!, played));
}
