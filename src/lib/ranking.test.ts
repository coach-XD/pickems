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
  it("breaks ties by correct placement picks before sharing a rank", () => {
    const ranked = rankRows([
      row("Casey", 4, 2, 1),
      row("Morgan", 10, 0, 0),
      row("Quinn", 4, 2, 1),
      row("Avery", 6, 0, 0),
    ]);

    const byName = Object.fromEntries(ranked.map((entry) => [entry.name, entry]));
    expect(byName.Morgan.rank).toBe(1);
    expect(byName.Morgan.tied).toBe(false);
    expect(formatRank(byName.Casey.rank, byName.Casey.tied)).toBe("T-2");
    expect(formatRank(byName.Quinn.rank, byName.Quinn.tied)).toBe("T-2");
    expect(byName.Casey.rank).toBe(byName.Quinn.rank);
    expect(byName.Avery.rank).toBe(4);
    expect(byName.Avery.tied).toBe(false);
    expect(byName.Avery.total).toBe(byName.Casey.total);
    expect(byName.Avery.correctPlacements).toBeLessThan(byName.Casey.correctPlacements);
  });

  it("shares first and skips to fourth when three players are level", () => {
    const ranked = rankRows([row("A", 5, 0, 2), row("B", 5, 0, 2), row("C", 5, 0, 2), row("D", 1, 0, 9)]);
    expect(ranked.slice(0, 3).map((entry) => formatRank(entry.rank, entry.tied))).toEqual(["T-1", "T-1", "T-1"]);
    expect(ranked[3]).toMatchObject({ name: "D", rank: 4, tied: false });
  });

  it("lets total points beat a stronger placement tiebreak", () => {
    const ranked = rankRows([row("High", 10, 0, 0), row("Placer", 5, 4, 8)]);
    expect(ranked.map((entry) => entry.name)).toEqual(["High", "Placer"]);
  });
});
