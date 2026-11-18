import { describe, expect, it } from "vitest";
import { FUTURE_STAGES } from "@/db/futureStages";
import { picksFromPlayoff, projectPlayoff, scorePlayoff } from "./playoff";
import { PLAYOFF_SCORING } from "./scoringConfig";

const teams = Array.from({ length: 8 }, (_, index) => ({ teamId: String(index + 1), seed: index + 1 }));

describe("playoff bracket", () => {
  it("seeds quarterfinals 1-8, 4-5, 2-7, 3-6", () => {
    const { ready, matches } = projectPlayoff({ teams, picks: [] });
    expect(ready).toBe(true);
    expect(matches.filter((match) => match.round === 1).map((match) => `${match.teamAId}-${match.teamBId}`)).toEqual([
      "1-8",
      "4-5",
      "2-7",
      "3-6",
    ]);
    expect(matches.filter((match) => match.round === 2).every((match) => match.teamAId == null)).toBe(true);
  });

  it("feeds semifinals and the final from the winners the player clicked", () => {
    const first = projectPlayoff({ teams, picks: [] });
    const qf = picksFromPlayoff(
      first.matches.filter((match) => match.round === 1).map((match) => ({ ...match, winnerId: match.teamAId })),
    );
    const withSemis = projectPlayoff({ teams, picks: qf });
    expect(withSemis.matches.filter((match) => match.round === 2).map((match) => `${match.teamAId}-${match.teamBId}`)).toEqual([
      "1-4",
      "2-3",
    ]);
    const sf = picksFromPlayoff(
      withSemis.matches.filter((match) => match.round === 2).map((match) => ({ ...match, winnerId: match.teamAId })),
    );
    const full = projectPlayoff({ teams, picks: [...qf, ...sf] });
    expect(full.matches.find((match) => match.round === 3)).toMatchObject({ teamAId: "1", teamBId: "2", format: "bo3" });
    const bo5 = projectPlayoff({ teams, picks: [...qf, ...sf], finalFormat: "bo5" });
    expect(bo5.matches.find((match) => match.round === 3)?.format).toBe("bo5");
  });

  it("scores only a real matchup, using the placeholder weights", () => {
    const picks = [
      { round: 1, teamAId: "1", teamBId: "8", winnerId: "1", scoreA: null, scoreB: null },
      { round: 1, teamAId: "4", teamBId: "5", winnerId: "5", scoreA: null, scoreB: null },
      { round: 2, teamAId: "1", teamBId: "5", winnerId: "1", scoreA: null, scoreB: null },
      { round: 3, teamAId: "1", teamBId: "2", winnerId: "1", scoreA: null, scoreB: null },
    ];
    const scored = scorePlayoff({
      teams,
      picks,
      realMatches: [
        { teamAId: "8", teamBId: "1", winnerId: "1" },
        { teamAId: "1", teamBId: "5", winnerId: "1" },
        { teamAId: "1", teamBId: "2", winnerId: "2" },
        { teamAId: "9", teamBId: "10", winnerId: "9" },
      ],
    });
    expect(scored.matchPoints).toBe(PLAYOFF_SCORING.quarterfinal + PLAYOFF_SCORING.semifinal);
    expect(scored.placementPoints).toBe(0);
  });

  it("keeps later stages closed with no teams", () => {
    expect(FUTURE_STAGES.map((stage) => [stage.slug, stage.picksOpen, stage.kind])).toEqual([
      ["stage-2", false, "swiss"],
      ["stage-3", false, "swiss"],
      ["playoffs", false, "playoff"],
    ]);
  });
});
