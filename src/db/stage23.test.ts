import { describe, expect, it } from "vitest";
import { STAGE1_TEAMS } from "./stage1";
import { STAGE23_TEAMS } from "./stage23";

describe("stage 2 and 3 invites", () => {
  it("loads eight direct invites for each later stage", () => {
    const stage2 = STAGE23_TEAMS.filter((team) => team.stage === "stage-2");
    const stage3 = STAGE23_TEAMS.filter((team) => team.stage === "stage-3");
    expect(stage2.map((team) => team.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(stage3.map((team) => team.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(STAGE23_TEAMS.map((team) => team.name)).size).toBe(16);
  });

  it("uses Sam's combined names and does not reuse a Stage 1 team", () => {
    const names = STAGE23_TEAMS.map((team) => team.name);
    expect(names).toContain("1win (The One)");
    expect(names).toContain("BetBoom (BB Team)");
    const stage1 = new Set(STAGE1_TEAMS.map((team) => team.name));
    expect(names.filter((name) => stage1.has(name))).toEqual([]);
  });

  it("gives every invite five players and the Valve 2 Nov points", () => {
    for (const team of STAGE23_TEAMS) {
      expect(team.players).toHaveLength(5);
      expect(new Set(team.players.map((player) => player.nickname)).size).toBe(5);
    }
    expect(STAGE23_TEAMS.find((team) => team.name === "MOUZ")).toMatchObject({ worldRank: 1, vrsPoints: 1960 });
    expect(STAGE23_TEAMS.find((team) => team.name === "1win (The One)")).toMatchObject({ worldRank: 12, vrsPoints: 1598 });
  });
});
