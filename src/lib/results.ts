import { enteringPools, projectBracket, sameMatchup, type BracketPick, type RealSeries, type RecordPool } from "./bracket";
import { scoreMatchPick, scorePlacementSlot } from "./scoring";
import { pairKey } from "./swiss";
import type { SeriesFormat, Slot } from "./types";

export type PickTone = "correct" | "wrong" | "pending" | "empty";

export type SeriesGrade = {
  tone: PickTone;
  points: number;
  winnerPoints: number;
  mapPoints: number;
  exact: boolean;
  /** The teams played, but not in this round and record. */
  mismatch: boolean;
  final?: string | null;
};

export type PlacementGrade = {
  tone: Exclude<PickTone, "empty">;
  points: number;
};

/**
 * Correct is a right winner. The extra map point is only an exact Bo3 score.
 * Pending means the series has no result yet. Empty means the player never picked it.
 */
export function gradeSeriesPick(input: {
  format: SeriesFormat;
  pickWinnerId: string | null;
  pickScoreA: number | null;
  pickScoreB: number | null;
  resultWinnerId: string | null;
  resultScoreA: number | null;
  resultScoreB: number | null;
}): SeriesGrade {
  if (!input.pickWinnerId) {
    return { tone: input.resultWinnerId ? "empty" : "pending", points: 0, winnerPoints: 0, mapPoints: 0, exact: false, mismatch: false };
  }
  if (!input.resultWinnerId) {
    return { tone: "pending", points: 0, winnerPoints: 0, mapPoints: 0, exact: false, mismatch: false };
  }
  const scored = scoreMatchPick({
    format: input.format,
    pickWinnerId: input.pickWinnerId,
    pickScoreA: input.pickScoreA,
    pickScoreB: input.pickScoreB,
    resultWinnerId: input.resultWinnerId,
    resultScoreA: input.resultScoreA,
    resultScoreB: input.resultScoreB,
  });
  return {
    tone: scored.winnerPoints > 0 ? "correct" : "wrong",
    points: scored.winnerPoints + scored.mapPoints,
    winnerPoints: scored.winnerPoints,
    mapPoints: scored.mapPoints,
    exact: scored.mapPoints > 0,
    mismatch: false,
  };
}

const MISMATCH: SeriesGrade = { tone: "wrong", points: 0, winnerPoints: 0, mapPoints: 0, exact: false, mismatch: true };

type PoolPick = {
  round: number;
  wins: number;
  losses: number;
  format: SeriesFormat;
  teamAId: string;
  teamBId: string;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
};

/** Grade one simulated pick against the real slate. The pick's pool is its own path. */
export function gradeSimulatedPick(pick: PoolPick, realMatches: RealSeries[], pools = enteringPools(realMatches)): SeriesGrade {
  if (!pick.winnerId) {
    return { tone: "empty", points: 0, winnerPoints: 0, mapPoints: 0, exact: false, mismatch: false };
  }
  const samePair = realMatches.filter((match) => pairKey(match.teamAId, match.teamBId) === pairKey(pick.teamAId, pick.teamBId));
  const aligned = samePair.find((match) => sameMatchup(pick, match, pools.get(`${match.round}|${pairKey(match.teamAId, match.teamBId)}`)));
  if (!aligned) {
    return samePair.length > 0 ? MISMATCH : { tone: "pending", points: 0, winnerPoints: 0, mapPoints: 0, exact: false, mismatch: false };
  }
  const graded = gradeSeriesPick({
    format: aligned.format,
    pickWinnerId: pick.winnerId,
    pickScoreA: pick.scoreA,
    pickScoreB: pick.scoreB,
    resultWinnerId: aligned.winnerId,
    resultScoreA: aligned.scoreA,
    resultScoreB: aligned.scoreB,
  });
  return { ...graded, final: aligned.scoreA != null && aligned.scoreB != null ? `${aligned.scoreA}-${aligned.scoreB}` : null };
}

/** Grade the cell for a real match. A pick from another pool scores nothing. */
export function gradeRealMatch(input: {
  pick: PoolPick | null;
  real: RealSeries;
  pool: RecordPool | null;
}): SeriesGrade {
  if (!input.pick?.winnerId) {
    return gradeSeriesPick({
      format: input.real.format,
      pickWinnerId: null,
      pickScoreA: null,
      pickScoreB: null,
      resultWinnerId: input.real.winnerId,
      resultScoreA: input.real.scoreA,
      resultScoreB: input.real.scoreB,
    });
  }
  if (!sameMatchup(input.pick, input.real, input.pool)) return MISMATCH;
  return gradeSeriesPick({
    format: input.real.format,
    pickWinnerId: input.pick.winnerId,
    pickScoreA: input.pick.scoreA,
    pickScoreB: input.pick.scoreB,
    resultWinnerId: input.real.winnerId,
    resultScoreA: input.real.scoreA,
    resultScoreB: input.real.scoreB,
  });
}

/** 3-0, 0-3, and advance stay pending until the real record decides them. */
export function gradePlacementPick(slot: Slot, wins: number, losses: number): PlacementGrade {
  const scored = scorePlacementSlot(slot, wins, losses);
  if (scored.correct == null) return { tone: "pending", points: 0 };
  return { tone: scored.correct ? "correct" : "wrong", points: scored.points };
}

export function latestScoredMatch<T extends { winnerId: string | null; resultAt: Date | null; scheduledAt: Date; round: number }>(
  matches: T[],
): T | null {
  const done = matches.filter((match) => match.winnerId);
  if (done.length === 0) return null;
  return done.sort((a, b) => {
    const stamped = (b.resultAt?.getTime() ?? 0) - (a.resultAt?.getTime() ?? 0);
    if (stamped !== 0) return stamped;
    if (a.round !== b.round) return b.round - a.round;
    return b.scheduledAt.getTime() - a.scheduledAt.getTime();
  })[0];
}

/** Points one player earned from a single real series. Placement points are not included. */
export function pointsOnSeries(input: {
  teams: Array<{ teamId: string; seed: number }>;
  round1: Array<{ teamAId: string; teamBId: string }>;
  picks: BracketPick[];
  match: RealSeries;
  slate?: RealSeries[];
}): number {
  const slate = input.slate ?? [input.match];
  const pools = enteringPools(slate);
  const pool = pools.get(`${input.match.round}|${pairKey(input.match.teamAId, input.match.teamBId)}`) ?? null;
  const simulated = projectBracket({ teams: input.teams, round1: input.round1, picks: input.picks });
  const pick = simulated.find((row) => sameMatchup(row, input.match, pool) && row.winnerId) ?? null;
  return gradeRealMatch({ pick, real: input.match, pool }).points;
}
