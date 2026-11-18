import { describe, expect, it } from "vitest";
import { STAGE1_MATCHES, STAGE1_TEAMS } from "./stage1";

describe("stage 1 seed", () => {
  it("stores 16 unique seeds and the opening 1-vs-9 bracket", () => {
    expect(new Set(STAGE1_TEAMS.map((team) => team.seed)).size).toBe(16);
    expect(STAGE1_TEAMS.map((team) => team.seed).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1),
    );
    const pairs = STAGE1_MATCHES.map((match) => [match.seedA, match.seedB].sort((a, b) => a - b).join("-")).sort();
    expect(pairs).toEqual(["1-9", "2-10", "3-11", "4-12", "5-13", "6-14", "7-15", "8-16"]);
    expect(STAGE1_MATCHES.every((match) => match.format === "bo1" && match.round === 1)).toBe(true);
    expect(STAGE1_TEAMS.find((team) => team.seed === 2)).toMatchObject({
      name: "PARIVISION",
      worldRank: 13,
      otherRank: 14,
    });
  });
});
