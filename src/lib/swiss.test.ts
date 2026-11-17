import { describe, expect, it } from "vitest";
import { buildSampleBoard, rankLabel } from "./demo";
import {
  deriveStandings,
  seriesFormat,
  simulateChalkSwiss,
  suggestPairings,
  type SimTeam,
} from "./swiss";

const teams: SimTeam[] = Array.from({ length: 16 }, (_, index) => ({
  teamId: String(index + 1),
  seed: index + 1,
}));

describe("swiss records", () => {
  it("derives an empty bracket as 0-0", () => {
    const standings = deriveStandings(teams, []);
    expect(standings).toHaveLength(16);
    expect(standings.every((row) => row.wins === 0 && row.losses === 0 && row.status === "active")).toBe(true);
  });

  it("finishes a 16-team chalk swiss with the major's advancement split", () => {
    const matches = simulateChalkSwiss(teams);
    const standings = deriveStandings(teams, matches);
    const count = (wins: number, losses: number) =>
      standings.filter((row) => row.wins === wins && row.losses === losses).length;

    expect(matches).toHaveLength(33);
    expect(matches.filter((match) => match.format === "bo1")).toHaveLength(20);
    expect(matches.filter((match) => match.format === "bo3")).toHaveLength(13);
    expect(count(3, 0)).toBe(2);
    expect(count(3, 1)).toBe(3);
    expect(count(3, 2)).toBe(3);
    expect(count(0, 3)).toBe(2);
    expect(count(1, 3)).toBe(3);
    expect(count(2, 3)).toBe(3);
    expect(standings.filter((row) => row.status === "advanced")).toHaveLength(8);
    expect(standings.filter((row) => row.status === "eliminated")).toHaveLength(8);

    const recordOf = (seed: number) => standings.find((row) => row.seed === seed)!;
    expect(recordOf(1)).toMatchObject({ wins: 3, losses: 0 });
    expect(recordOf(2)).toMatchObject({ wins: 3, losses: 0 });
    expect([3, 4, 5].map((seed) => `${recordOf(seed).wins}-${recordOf(seed).losses}`)).toEqual(["3-1", "3-1", "3-1"]);
    expect([6, 7, 8].map((seed) => `${recordOf(seed).wins}-${recordOf(seed).losses}`)).toEqual(["3-2", "3-2", "3-2"]);
    expect([15, 16].map((seed) => `${recordOf(seed).wins}-${recordOf(seed).losses}`)).toEqual(["0-3", "0-3"]);
  });

  it("ignores a series played after a team has already advanced", () => {
    const standings = deriveStandings(
      [
        { teamId: "a", seed: 1 },
        { teamId: "b", seed: 2 },
      ],
      [
        { round: 1, teamAId: "a", teamBId: "b", winnerId: "a" },
        { round: 2, teamAId: "a", teamBId: "b", winnerId: "a" },
        { round: 3, teamAId: "a", teamBId: "b", winnerId: "a" },
        { round: 4, teamAId: "a", teamBId: "b", winnerId: "b" },
      ],
    );
    expect(standings.find((row) => row.teamId === "a")).toMatchObject({ wins: 3, losses: 0, status: "advanced" });
    expect(standings.find((row) => row.teamId === "b")).toMatchObject({ wins: 0, losses: 3, status: "eliminated" });
  });
});

describe("pairing suggestions", () => {
  it("pairs a pool high seed against low seed and skips a rematch", () => {
    const standings = [1, 2, 3, 4].map((seed) => ({
      teamId: String(seed),
      seed,
      wins: 0,
      losses: 0,
      status: "active" as const,
    }));
    const clean = suggestPairings(standings, []);
    expect(clean.pairs.map((pair) => [pair.teamAId, pair.teamBId])).toEqual([
      ["1", "4"],
      ["2", "3"],
    ]);
    expect(clean.pairs.every((pair) => pair.format === "bo1" && !pair.rematch)).toBe(true);

    const avoided = suggestPairings(standings, [["1", "4"]]);
    expect(avoided.pairs.map((pair) => [pair.teamAId, pair.teamBId].sort().join(""))).toEqual(["13", "24"]);
    expect(avoided.pairs.every((pair) => !pair.rematch)).toBe(true);
    expect(avoided.leftovers).toEqual([]);
  });

  it("leaves a finished team out and uses Bo3 once the series can advance or eliminate", () => {
    expect(seriesFormat(2, 0)).toBe("bo3");
    expect(seriesFormat(0, 2)).toBe("bo3");
    expect(seriesFormat(2, 2)).toBe("bo3");
    expect(seriesFormat(1, 1)).toBe("bo1");

    const { pairs, leftovers } = suggestPairings(
      [
        { teamId: "done", seed: 1, wins: 3, losses: 0, status: "advanced" },
        { teamId: "a", seed: 2, wins: 2, losses: 1, status: "active" },
        { teamId: "b", seed: 3, wins: 2, losses: 1, status: "active" },
        { teamId: "c", seed: 4, wins: 2, losses: 1, status: "active" },
      ],
      [],
    );
    expect(leftovers).toEqual(["b"]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ teamAId: "a", teamBId: "c", format: "bo3", record: "2-1" });
  });
});

describe("sample board", () => {
  it("separates the map bonus and shares a rank when points and placements match", () => {
    const named = teams.map((team) => ({ ...team, name: `Team ${team.seed}` }));
    const board = buildSampleBoard(named);
    const byName = Object.fromEntries(board.ranked.map((row) => [row.name, row]));

    expect(byName.Nova.matchPoints).toBe(33);
    expect(byName.Nova.mapPoints).toBe(13);
    expect(byName.Nova.placementPoints).toBe(32);
    expect(byName.Pixel.matchPoints).toBe(byName.Nova.matchPoints);
    expect(byName.Pixel.mapPoints).toBe(0);
    expect(byName.Pixel.placementPoints).toBe(32);
    expect(byName.Nova.total).toBe(byName.Pixel.total + 13);

    expect(byName.Rook.placementPoints).toBe(10);
    expect(byName.Rook.correctPlacements).toBe(5);
    expect(byName.Rook.matchPoints).toBe(33);
    expect(byName.Rook.mapPoints).toBe(13);

    expect(byName.Blitz.total).toBe(byName.Echo.total);
    expect(byName.Blitz.correctPlacements).toBe(byName.Echo.correctPlacements);
    expect(rankLabel(byName.Blitz)).toBe("T-4");
    expect(rankLabel(byName.Echo)).toBe("T-4");
    expect(byName.Jett.rank).toBe(6);
    expect(byName.Ivy.total).toBe(0);
    expect(board.ranked.map((row) => rankLabel(row))).toEqual(["1", "2", "3", "T-4", "T-4", "6", "7", "8"]);
  });
});
