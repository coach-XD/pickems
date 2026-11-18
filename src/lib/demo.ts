import { autoPlay, scoreBracket, type BracketPick } from "./bracket";
import { rankRows, type RankedScore } from "./ranking";
import { deriveStandings } from "./swiss";
import { initialSwissPairs, type SeededTeam } from "./valveSwiss";

export const DEMO_PIN = "2468";
export const DEMO_SLUG = "demo-stage";

export type SamplePlayer = {
  name: string;
  picks: BracketPick[];
};

export type SampleBoard = {
  matches: Array<BracketPick & { format: "bo1" | "bo3" }>;
  players: SamplePlayer[];
  ranked: RankedScore[];
};

function flipMargins(picks: BracketPick[]): BracketPick[] {
  return picks.map((pick) => {
    if (pick.scoreA == null || pick.scoreB == null) return pick;
    const winnerIsA = pick.winnerId === pick.teamAId;
    const loser = winnerIsA ? pick.scoreB : pick.scoreA;
    const flipped = loser === 0 ? 1 : 0;
    return {
      ...pick,
      scoreA: winnerIsA ? 2 : flipped,
      scoreB: winnerIsA ? flipped : 2,
    };
  });
}

export function buildSampleBoard(teams: Array<SeededTeam & { name: string }>): SampleBoard {
  const roster = teams.map(({ teamId, seed }) => ({ teamId, seed }));
  let bo3Count = 0;
  const perfect = autoPlay({
    teams: roster,
    choose: (match) => {
      const margin = match.format === "bo3" ? (bo3Count % 2 === 0 ? "2-0" : "2-1") : null;
      if (match.format === "bo3") bo3Count += 1;
      return { winnerId: match.teamAId, margin };
    },
  });
  const favorites = perfect;
  const underdogs = autoPlay({
    teams: roster,
    choose: (match) => ({ winnerId: match.teamBId, margin: match.format === "bo3" ? "2-0" : null }),
  });

  const through = (round: number, source = favorites) => source.filter((pick) => pick.round <= round);
  const players: SamplePlayer[] = [
    { name: "Nova", picks: favorites },
    { name: "Pixel", picks: flipMargins(favorites) },
    { name: "Rook", picks: through(3) },
    { name: "Jett", picks: through(2) },
    { name: "Blitz", picks: through(1) },
    { name: "Echo", picks: through(1) },
    { name: "Ivy", picks: underdogs },
    { name: "Kite", picks: [] },
  ];

  const round1 = initialSwissPairs(roster);
  const realMatches = favorites.map((pick) => ({
    round: pick.round,
    teamAId: pick.teamAId,
    teamBId: pick.teamBId,
    format: pick.scoreA == null ? ("bo1" as const) : ("bo3" as const),
    winnerId: pick.winnerId,
    scoreA: pick.scoreA ?? (pick.winnerId === pick.teamAId ? 1 : 0),
    scoreB: pick.scoreB ?? (pick.winnerId === pick.teamBId ? 1 : 0),
  }));
  const records = new Map(
    deriveStandings(roster, realMatches).map((row) => [row.teamId, { wins: row.wins, losses: row.losses }]),
  );
  const ranked = rankRows(
    players.map((player) => ({
      playerId: player.name,
      name: player.name,
      ...scoreBracket({ teams: roster, round1, picks: player.picks, realMatches, realRecords: records }),
    })),
  );

  return {
    matches: realMatches.map((match) => ({
      round: match.round,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      winnerId: match.winnerId!,
      scoreA: match.format === "bo1" ? 1 : match.scoreA,
      scoreB: match.format === "bo1" ? 0 : match.scoreB,
      format: match.format,
    })),
    players,
    ranked,
  };
}
