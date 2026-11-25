import type { SeriesFormat, Slot } from "./types";
import { teamStatus } from "./swiss";

export type PlacementScore = {
  points: number;
  /** Null while the slot can still come true. */
  correct: boolean | null;
};

/**
 * 3-0 picks pay only for a real 3-0. 0-3 picks pay only for a real 0-3.
 * An advance pick pays only for a real 3-1 or 3-2. A 3-0 finish makes it wrong.
 */
export function scorePlacementSlot(slot: Slot, wins: number, losses: number): PlacementScore {
  const status = teamStatus(wins, losses);

  if (slot === "perfect") {
    if (wins >= 3 && losses === 0) return { points: 5, correct: true };
    if (losses >= 1 || status === "eliminated") return { points: 0, correct: false };
    return { points: 0, correct: null };
  }

  if (slot === "winless") {
    if (losses >= 3 && wins === 0) return { points: 5, correct: true };
    if (wins >= 1 || status === "advanced") return { points: 0, correct: false };
    return { points: 0, correct: null };
  }

  if (wins >= 3 && losses === 0) return { points: 0, correct: false };
  if (wins >= 3 && (losses === 1 || losses === 2)) return { points: 2, correct: true };
  if (status === "eliminated") return { points: 0, correct: false };
  return { points: 0, correct: null };
}

export function scoreMatchPick(input: {
  format: SeriesFormat;
  pickWinnerId: string | null;
  pickScoreA: number | null;
  pickScoreB: number | null;
  resultWinnerId: string | null;
  resultScoreA: number | null;
  resultScoreB: number | null;
}): { winnerPoints: number; mapPoints: number } {
  if (!input.resultWinnerId || !input.pickWinnerId) {
    return { winnerPoints: 0, mapPoints: 0 };
  }
  if (input.pickWinnerId !== input.resultWinnerId) {
    return { winnerPoints: 0, mapPoints: 0 };
  }

  const exact =
    input.format === "bo3" &&
    input.pickScoreA != null &&
    input.pickScoreB != null &&
    input.resultScoreA != null &&
    input.resultScoreB != null &&
    input.pickScoreA === input.resultScoreA &&
    input.pickScoreB === input.resultScoreB;

  return { winnerPoints: 1, mapPoints: exact ? 1 : 0 };
}

export type StageScore = {
  matchPoints: number;
  mapPoints: number;
  placementPoints: number;
  correctPlacements: number;
};

export function emptyStageScore(): StageScore {
  return { matchPoints: 0, mapPoints: 0, placementPoints: 0, correctPlacements: 0 };
}

export function scorePlayerStage(input: {
  matches: Array<{
    id: string;
    format: SeriesFormat;
    winnerId: string | null;
    scoreA: number | null;
    scoreB: number | null;
  }>;
  matchPicks: Array<{
    matchId: string;
    winnerId: string;
    scoreA: number | null;
    scoreB: number | null;
  }>;
  placementPicks: Array<{ teamId: string; slot: Slot }>;
  records: Map<string, { wins: number; losses: number }>;
}): StageScore {
  const picks = new Map(input.matchPicks.map((pick) => [pick.matchId, pick]));
  const score = emptyStageScore();

  for (const match of input.matches) {
    const pick = picks.get(match.id);
    if (!pick) continue;
    const series = scoreMatchPick({
      format: match.format,
      pickWinnerId: pick.winnerId,
      pickScoreA: pick.scoreA,
      pickScoreB: pick.scoreB,
      resultWinnerId: match.winnerId,
      resultScoreA: match.scoreA,
      resultScoreB: match.scoreB,
    });
    score.matchPoints += series.winnerPoints;
    score.mapPoints += series.mapPoints;
  }

  for (const pick of input.placementPicks) {
    const record = input.records.get(pick.teamId);
    if (!record) continue;
    const slot = scorePlacementSlot(pick.slot, record.wins, record.losses);
    score.placementPoints += slot.points;
    if (slot.correct) score.correctPlacements += 1;
  }

  return score;
}

export function addStageScores(a: StageScore, b: StageScore): StageScore {
  return {
    matchPoints: a.matchPoints + b.matchPoints,
    mapPoints: a.mapPoints + b.mapPoints,
    placementPoints: a.placementPoints + b.placementPoints,
    correctPlacements: a.correctPlacements + b.correctPlacements,
  };
}
