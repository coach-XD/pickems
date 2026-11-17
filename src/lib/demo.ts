import { formatRank, rankRows, type RankedScore } from "./ranking";
import { scorePlayerStage } from "./scoring";
import { deriveStandings, simulateChalkSwiss, type SimulatedMatch, type SimTeam } from "./swiss";
import type { Slot } from "./types";

export const DEMO_PIN = "2468";
export const DEMO_SLUG = "demo-stage";

export type SamplePlayer = {
  name: string;
  placements: Array<{ teamId: string; slot: Slot }>;
  picks: Array<{
    round: number;
    teamAId: string;
    teamBId: string;
    winnerId: string;
    scoreA: number | null;
    scoreB: number | null;
  }>;
};

export type SampleBoard = {
  matches: SimulatedMatch[];
  players: SamplePlayer[];
  ranked: RankedScore[];
  records: Map<string, { wins: number; losses: number; seed: number }>;
};

function idOf(bySeed: Map<number, string>, seed: number): string {
  const teamId = bySeed.get(seed);
  if (!teamId) throw new Error(`Missing seed ${seed}`);
  return teamId;
}

function slate(
  bySeed: Map<number, string>,
  perfect: number[],
  winless: number[],
  advance: number[],
): Array<{ teamId: string; slot: Slot }> {
  return [
    ...perfect.map((seed) => ({ teamId: idOf(bySeed, seed), slot: "perfect" as const })),
    ...winless.map((seed) => ({ teamId: idOf(bySeed, seed), slot: "winless" as const })),
    ...advance.map((seed) => ({ teamId: idOf(bySeed, seed), slot: "advance" as const })),
  ];
}

function exactPick(match: SimulatedMatch) {
  return {
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    winnerId: match.winnerId,
    scoreA: match.format === "bo1" ? null : match.scoreA,
    scoreB: match.format === "bo1" ? null : match.scoreB,
  };
}

function flippedPick(match: SimulatedMatch) {
  if (match.format === "bo1") return exactPick(match);
  const winnerIsA = match.winnerId === match.teamAId;
  const loserScore = winnerIsA ? match.scoreB : match.scoreA;
  const flipped = loserScore === 0 ? 1 : 0;
  return {
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    winnerId: match.winnerId,
    scoreA: winnerIsA ? 2 : flipped,
    scoreB: winnerIsA ? flipped : 2,
  };
}

function loserPick(match: SimulatedMatch) {
  const winnerId = match.winnerId === match.teamAId ? match.teamBId : match.teamAId;
  const winnerIsA = winnerId === match.teamAId;
  return {
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    winnerId,
    scoreA: match.format === "bo1" ? null : winnerIsA ? 2 : 0,
    scoreB: match.format === "bo1" ? null : winnerIsA ? 0 : 2,
  };
}

/**
 * A finished sample Swiss with eight players. Higher seeds always win, so the
 * records are deterministic: two 3-0s, three 3-1s, three 3-2s, and the mirror
 * on the elimination side. Nova is perfect. Pixel matches every winner and
 * misses every Bo3 score. Blitz and Echo tie.
 */
export function buildSampleBoard(teams: Array<SimTeam & { name: string }>): SampleBoard {
  const matches = simulateChalkSwiss(teams);
  const bySeed = new Map(teams.map((team) => [team.seed, team.teamId]));
  const seedOf = new Map(teams.map((team) => [team.teamId, team.seed]));
  const perfect = slate(bySeed, [1, 2], [15, 16], [3, 4, 5, 6, 7, 8]);
  const bad = slate(bySeed, [15, 16], [1, 2], [9, 10, 11, 12, 13, 14]);
  const rookSlate = slate(bySeed, [3, 4], [12, 13], [1, 2, 6, 7, 8, 9]);
  const jettSlate = slate(bySeed, [15, 16], [1, 2], [3, 4, 5, 6, 7, 8]);

  const players: SamplePlayer[] = [
    { name: "Nova", placements: perfect, picks: matches.map(exactPick) },
    { name: "Pixel", placements: perfect, picks: matches.map(flippedPick) },
    { name: "Rook", placements: rookSlate, picks: matches.map(exactPick) },
    { name: "Ivy", placements: bad, picks: matches.map(loserPick) },
    {
      name: "Blitz",
      placements: perfect,
      picks: matches.filter((match) => match.round === 1).map(exactPick),
    },
    {
      name: "Echo",
      placements: perfect,
      picks: matches.filter((match) => match.round === 2).map(exactPick),
    },
    {
      name: "Jett",
      placements: jettSlate,
      picks: matches.filter((match) => match.round === 1 || match.round === 2).map(exactPick),
    },
    {
      name: "Kite",
      placements: bad,
      picks: matches
        .filter((match) => match.round === 1 && (seedOf.get(match.teamAId) ?? 99) <= 4)
        .map(exactPick),
    },
  ];

  const standings = deriveStandings(teams, matches);
  const records = new Map(standings.map((row) => [row.teamId, { wins: row.wins, losses: row.losses, seed: row.seed }]));
  const matchRows = matches.map((match, index) => ({
    id: `${match.round}:${match.teamAId}:${match.teamBId}:${index}`,
    format: match.format,
    winnerId: match.winnerId,
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
  }));

  const ranked = rankRows(
    players.map((player) => {
      const picks = player.picks.map((pick) => {
        const match = matchRows.find(
          (row) => row.round === pick.round && row.teamAId === pick.teamAId && row.teamBId === pick.teamBId,
        );
        if (!match) throw new Error(`Missing sample match for ${player.name}`);
        return { matchId: match.id, winnerId: pick.winnerId, scoreA: pick.scoreA, scoreB: pick.scoreB };
      });
      const score = scorePlayerStage({
        matches: matchRows,
        matchPicks: picks,
        placementPicks: player.placements,
        records,
      });
      return { playerId: player.name, name: player.name, ...score };
    }),
  );

  return { matches, players, ranked, records };
}

export function rankLabel(row: RankedScore): string {
  return formatRank(row.rank, row.tied);
}
