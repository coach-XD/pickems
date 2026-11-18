import { describe, expect, it } from "vitest";
import { formatRank, rankRows } from "./ranking";

function row(
  name: string,
  matchPoints: number,
  placementPoints: number,
  correctPlacements: number,
  mapPoints = 0,
) {
  return { playerId: name, name, matchPoints, mapPoints, placementPoints, correctPlacements };
}

describe("leaderboard ranking", () => {
  it("shares a rank on total points and does not use placement picks as a tiebreak", () => {
    const ranked = rankRows([
      row("Casey", 4, 2, 9),
      row("Morgan", 10, 0, 0),
      row("Quinn", 8, 0, 0),
      row("Avery", 4, 2, 1),
    ]);

    const byName = Object.fromEntries(ranked.map((entry) => [entry.name, entry]));
    expect(byName.Morgan).toMatchObject({ rank: 1, tied: false });
    expect(byName.Quinn).toMatchObject({ rank: 2, tied: false });
    expect(byName.Casey.rank).toBe(3);
    expect(byName.Avery.rank).toBe(3);
    expect(byName.Casey.tied).toBe(true);
    expect(byName.Avery.tied).toBe(true);
    expect(byName.Casey.correctPlacements).not.toBe(byName.Avery.correctPlacements);
    expect(formatRank(byName.Casey.rank)).toBe("3");
  });

  it("shares first and skips to fourth when three players are level", () => {
    const ranked = rankRows([row("A", 5, 0, 2), row("B", 5, 0, 0), row("C", 0, 5, 9), row("D", 1, 0, 9)]);
    expect(ranked.slice(0, 3).map((entry) => entry.rank)).toEqual([1, 1, 1]);
    expect(ranked[3]).toMatchObject({ name: "D", rank: 4, tied: false });
    expect(ranked.slice(0, 3).every((entry) => formatRank(entry.rank) === "1")).toBe(true);
  });

  it("orders a higher total ahead of a lower one", () => {
    const ranked = rankRows([row("High", 10, 0, 0), row("Placer", 5, 4, 8)]);
    expect(ranked.map((entry) => entry.name)).toEqual(["High", "Placer"]);
  });
});