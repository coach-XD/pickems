import { scorePlacementSlot } from "./scoring";
import { deriveStandings, pairKey, teamStatus } from "./swiss";
import type { SeriesFormat, Slot } from "./types";
import { initialSwissPairs, pairNextRound, type SeededTeam } from "./valveSwiss";

export type BracketPick = {
  round: number;
  teamAId: string;
  teamBId: string;
  winnerId: string;
  scoreA: number | null;
  scoreB: number | null;
};

export type BracketMatch = {
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

export type RealSeries = {
  round: number;
  teamAId: string;
  teamBId: string;
  format: SeriesFormat;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
};

function pickKey(round: number, teamAId: string, teamBId: string): string {
  return `${round}|${pairKey(teamAId, teamBId)}`;
}

export function marginOf(scoreA: number | null, scoreB: number | null, winnerIsA: boolean): "2-0" | "2-1" | null {
  if (scoreA == null || scoreB == null) return null;
  const winnerMaps = winnerIsA ? scoreA : scoreB;
  const loserMaps = winnerIsA ? scoreB : scoreA;
  if (winnerMaps !== 2) return null;
  if (loserMaps === 0) return "2-0";
  if (loserMaps === 1) return "2-1";
  return null;
}

function acceptedScore(
  format: SeriesFormat,
  teamAId: string,
  winnerId: string,
  scoreA: number | null,
  scoreB: number | null,
): { scoreA: number | null; scoreB: number | null } {
  if (format === "bo1") return { scoreA: null, scoreB: null };
  const margin = marginOf(scoreA, scoreB, winnerId === teamAId);
  if (!margin) return { scoreA: null, scoreB: null };
  const loser = margin === "2-0" ? 0 : 1;
  return winnerId === teamAId ? { scoreA: 2, scoreB: loser } : { scoreA: loser, scoreB: 2 };
}

export function projectBracket(input: {
  teams: SeededTeam[];
  round1: Array<{ teamAId: string; teamBId: string }>;
  picks: BracketPick[];
}): BracketMatch[] {
  const picks = new Map(input.picks.map((pick) => [pickKey(pick.round, pick.teamAId, pick.teamBId), pick]));
  const matches: BracketMatch[] = [];
  const completed: Array<{ round: number; teamAId: string; teamBId: string; winnerId: string }> = [];
  const seedOf = new Map(input.teams.map((team) => [team.teamId, team.seed]));
  const opening = (input.round1.length > 0 ? input.round1 : initialSwissPairs(input.teams)).map((pair) => {
    const seedA = seedOf.get(pair.teamAId) ?? 999;
    const seedB = seedOf.get(pair.teamBId) ?? 999;
    return seedA <= seedB ? pair : { teamAId: pair.teamBId, teamBId: pair.teamAId };
  });
  opening.sort((a, b) => (seedOf.get(a.teamAId) ?? 999) - (seedOf.get(b.teamAId) ?? 999));
  let upcoming = opening;

  for (let round = 1; round <= 5; round += 1) {
    if (upcoming.length === 0) break;
    const table = new Map(input.teams.map((team) => [team.teamId, { wins: 0, losses: 0 }]));
    for (const match of completed) {
      const sideA = table.get(match.teamAId);
      const sideB = table.get(match.teamBId);
      if (!sideA || !sideB) continue;
      if (teamStatus(sideA.wins, sideA.losses) !== "active" || teamStatus(sideB.wins, sideB.losses) !== "active") continue;
      if (match.winnerId === match.teamAId) {
        sideA.wins += 1;
        sideB.losses += 1;
      } else if (match.winnerId === match.teamBId) {
        sideB.wins += 1;
        sideA.losses += 1;
      }
    }

    let open = false;
    for (const pair of upcoming) {
      const sideA = table.get(pair.teamAId);
      const sideB = table.get(pair.teamBId);
      const wins = sideA?.wins ?? sideB?.wins ?? 0;
      const losses = sideA?.losses ?? sideB?.losses ?? 0;
      const format: SeriesFormat = round === 1 ? "bo1" : wins >= 2 || losses >= 2 ? "bo3" : "bo1";
      const pick = picks.get(pickKey(round, pair.teamAId, pair.teamBId));
      const winnerId = pick && (pick.winnerId === pair.teamAId || pick.winnerId === pair.teamBId) ? pick.winnerId : null;
      const scores = winnerId ? acceptedScore(format, pair.teamAId, winnerId, pick?.scoreA ?? null, pick?.scoreB ?? null) : { scoreA: null, scoreB: null };
      matches.push({
        round,
        wins,
        losses,
        format,
        teamAId: pair.teamAId,
        teamBId: pair.teamBId,
        winnerId,
        scoreA: scores.scoreA,
        scoreB: scores.scoreB,
      });
      if (!winnerId) open = true;
      else completed.push({ round, teamAId: pair.teamAId, teamBId: pair.teamBId, winnerId });
    }
    if (open) break;
    const next = pairNextRound({ teams: input.teams, completed, round: round + 1 });
    upcoming = next.map((pair) => ({ teamAId: pair.teamAId, teamBId: pair.teamBId }));
  }

  return matches;
}

export function autoPlay(input: {
  teams: SeededTeam[];
  choose: (match: BracketMatch) => { winnerId: string; margin: "2-0" | "2-1" | null } | null;
}): BracketPick[] {
  const picks: BracketPick[] = [];
  for (let guard = 0; guard < 40; guard += 1) {
    const open = projectBracket({ teams: input.teams, round1: initialSwissPairs(input.teams), picks }).find((match) => !match.winnerId);
    if (!open) return picks;
    const choice = input.choose(open);
    if (!choice) return picks;
    const margin = open.format === "bo3" ? choice.margin : null;
    const winnerIsA = choice.winnerId === open.teamAId;
    picks.push({
      round: open.round,
      teamAId: open.teamAId,
      teamBId: open.teamBId,
      winnerId: choice.winnerId,
      scoreA: margin == null ? null : winnerIsA ? 2 : margin === "2-0" ? 0 : 1,
      scoreB: margin == null ? null : winnerIsA ? (margin === "2-0" ? 0 : 1) : 2,
    });
  }
  return picks;
}

export function picksFromBracket(matches: BracketMatch[]): BracketPick[] {
  return matches.flatMap((match) =>
    match.winnerId
      ? [{
          round: match.round,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          winnerId: match.winnerId,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        }]
      : [],
  );
}

export function derivedPlacements(teams: SeededTeam[], matches: BracketMatch[]): Array<{ teamId: string; slot: Slot }> {
  const standings = deriveStandings(
    teams,
    matches
      .filter((match) => match.winnerId)
      .map((match) => ({
        round: match.round,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        winnerId: match.winnerId,
      })),
  );
  const slots: Array<{ teamId: string; slot: Slot }> = [];
  for (const row of standings) {
    if (row.wins >= 3 && row.losses === 0) slots.push({ teamId: row.teamId, slot: "perfect" });
    else if (row.losses >= 3 && row.wins === 0) slots.push({ teamId: row.teamId, slot: "winless" });
    else if (row.wins >= 3) slots.push({ teamId: row.teamId, slot: "advance" });
  }
  return slots;
}

export function scoreBracket(input: {
  teams: SeededTeam[];
  round1: Array<{ teamAId: string; teamBId: string }>;
  picks: BracketPick[];
  realMatches: RealSeries[];
  realRecords: Map<string, { wins: number; losses: number }>;
}): { matchPoints: number; mapPoints: number; placementPoints: number; correctPlacements: number } {
  const simulated = projectBracket(input);
  const realByKey = new Map<string, RealSeries>();
  for (const match of input.realMatches) {
    realByKey.set(`${match.round}|${pairKey(match.teamAId, match.teamBId)}`, match);
    const loose = pairKey(match.teamAId, match.teamBId);
    if (!realByKey.has(loose)) realByKey.set(loose, match);
  }

  let matchPoints = 0;
  let mapPoints = 0;
  for (const pick of simulated) {
    if (!pick.winnerId) continue;
    const real =
      realByKey.get(`${pick.round}|${pairKey(pick.teamAId, pick.teamBId)}`) ??
      realByKey.get(pairKey(pick.teamAId, pick.teamBId));
    if (!real?.winnerId || real.winnerId !== pick.winnerId) continue;
    matchPoints += 1;
    if (real.format === "bo3" && pick.format === "bo3") {
      const predicted = marginOf(pick.scoreA, pick.scoreB, pick.winnerId === pick.teamAId);
      const actual = marginOf(real.scoreA, real.scoreB, real.winnerId === real.teamAId);
      if (predicted && actual && predicted === actual) mapPoints += 1;
    }
  }

  let placementPoints = 0;
  let correctPlacements = 0;
  for (const slot of derivedPlacements(input.teams, simulated)) {
    const record = input.realRecords.get(slot.teamId);
    if (!record) continue;
    const scored = scorePlacementSlot(slot.slot, record.wins, record.losses);
    placementPoints += scored.points;
    if (scored.correct) correctPlacements += 1;
  }

  return { matchPoints, mapPoints, placementPoints, correctPlacements };
}
