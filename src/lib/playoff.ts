import { pairKey } from "./swiss";
import { playoffPointsForRound } from "./scoringConfig";
import type { SeriesFormat } from "./types";

export type PlayoffTeam = { teamId: string; seed: number };

export type PlayoffMatch = {
  round: number;
  label: string;
  format: SeriesFormat | "bo5";
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
};

export type PlayoffPick = {
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId: string;
  scoreA: number | null;
  scoreB: number | null;
};

const QF_INDEXES: Array<[number, number]> = [
  [0, 7],
  [3, 4],
  [1, 6],
  [2, 5],
];

function winnerOf(picks: PlayoffPick[], round: number, teamAId: string, teamBId: string): string | null {
  const key = pairKey(teamAId, teamBId);
  const pick = picks.find((row) => row.round === round && pairKey(row.teamAId, row.teamBId) === key);
  if (!pick) return null;
  if (pick.winnerId !== teamAId && pick.winnerId !== teamBId) return null;
  return pick.winnerId;
}

export function projectPlayoff(input: {
  teams: PlayoffTeam[];
  picks: PlayoffPick[];
  finalFormat?: "bo3" | "bo5";
}): { ready: boolean; matches: PlayoffMatch[] } {
  if (input.teams.length < 8) return { ready: false, matches: [] };
  const ranked = [...input.teams].sort((a, b) => a.seed - b.seed || a.teamId.localeCompare(b.teamId)).slice(0, 8);
  const finalFormat = input.finalFormat ?? "bo3";
  const quarters: PlayoffMatch[] = QF_INDEXES.map(([left, right], index) => {
    const teamAId = ranked[left].teamId;
    const teamBId = ranked[right].teamId;
    return {
      round: 1,
      label: `Quarterfinal ${index + 1}`,
      format: "bo3",
      teamAId,
      teamBId,
      winnerId: winnerOf(input.picks, 1, teamAId, teamBId),
    };
  });

  const semiPairs = [
    { left: quarters[0], right: quarters[1], label: "Semifinal 1" },
    { left: quarters[2], right: quarters[3], label: "Semifinal 2" },
  ];
  const semis: PlayoffMatch[] = semiPairs.map(({ left, right, label }) => {
    const teamAId = left.winnerId;
    const teamBId = right.winnerId;
    return {
      round: 2,
      label,
      format: "bo3" as const,
      teamAId,
      teamBId,
      winnerId: teamAId && teamBId ? winnerOf(input.picks, 2, teamAId, teamBId) : null,
    };
  });

  const finalists = semis.map((match) => match.winnerId);
  const final: PlayoffMatch = {
    round: 3,
    label: "Final",
    format: finalFormat,
    teamAId: finalists[0],
    teamBId: finalists[1],
    winnerId:
      finalists[0] && finalists[1] ? winnerOf(input.picks, 3, finalists[0], finalists[1]) : null,
  };

  return { ready: true, matches: [...quarters, ...semis, final] };
}

export function picksFromPlayoff(matches: PlayoffMatch[]): PlayoffPick[] {
  return matches.flatMap((match) =>
    match.winnerId && match.teamAId && match.teamBId
      ? [{
          round: match.round,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          winnerId: match.winnerId,
          scoreA: null,
          scoreB: null,
        }]
      : [],
  );
}

export function scorePlayoff(input: {
  teams: PlayoffTeam[];
  picks: PlayoffPick[];
  finalFormat?: "bo3" | "bo5";
  realMatches: Array<{ teamAId: string; teamBId: string; winnerId: string | null }>;
}): { matchPoints: number; mapPoints: number; placementPoints: number; correctPlacements: number } {
  const projected = projectPlayoff(input);
  const realByPair = new Map(input.realMatches.map((match) => [pairKey(match.teamAId, match.teamBId), match]));
  let matchPoints = 0;
  for (const match of projected.matches) {
    if (!match.winnerId || !match.teamAId || !match.teamBId) continue;
    const real = realByPair.get(pairKey(match.teamAId, match.teamBId));
    if (!real?.winnerId || real.winnerId !== match.winnerId) continue;
    matchPoints += playoffPointsForRound(match.round);
  }
  return { matchPoints, mapPoints: 0, placementPoints: 0, correctPlacements: 0 };
}
