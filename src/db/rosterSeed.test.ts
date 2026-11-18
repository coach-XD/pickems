import { describe, expect, it } from "vitest";
import { planRosterSeed, rosterPlayersFromFiles, STAGE1_RATINGS, STAGE1_ROSTERS } from "./rosterSeed";

describe("stage 1 roster files", () => {
  it("matches every player to a team-period rating", () => {
    const players = rosterPlayersFromFiles();
    expect(STAGE1_ROSTERS).toHaveLength(16);
    expect(players).toHaveLength(80);
    expect(STAGE1_RATINGS).toHaveLength(80);
    expect(players.every((player) => player.rating != null)).toBe(true);
  });
});

describe("planRosterSeed", () => {
  const wanted = rosterPlayersFromFiles(
    [{ team: "FaZe", players: [{ nickname: "frozen" }, { nickname: "Twistzz" }] }],
    [
      { team: "FaZe", nickname: "frozen", rating: 1.2 },
      { team: "FaZe", nickname: "Twistzz", rating: 1.01 },
    ],
  );

  it("inserts missing players with their ratings", () => {
    expect(planRosterSeed([], wanted).inserts).toEqual([
      { teamName: "FaZe", nickname: "frozen", sortOrder: 0, rating: 1.2 },
      { teamName: "FaZe", nickname: "Twistzz", sortOrder: 1, rating: 1.01 },
    ]);
  });

  it("fills only a null rating and leaves an edited rating in place", () => {
    const plan = planRosterSeed(
      [
        { teamName: "FaZe", nickname: "frozen", sortOrder: 0, rating: 0.8 },
        { teamName: "FaZe", nickname: "Twistzz", sortOrder: 1, rating: null },
      ],
      wanted,
    );
    expect(plan.inserts).toEqual([]);
    expect(plan.ratingUpdates).toEqual([{ teamName: "FaZe", nickname: "Twistzz", rating: 1.01 }]);
  });

  it("does not add a second row when an admin renamed that slot", () => {
    const plan = planRosterSeed(
      [{ teamName: "FaZe", nickname: "jcobbb", sortOrder: 0, rating: null }],
      wanted,
    );
    expect(plan.inserts.map((row) => row.nickname)).toEqual(["Twistzz"]);
    expect(plan.ratingUpdates).toEqual([]);
  });
});
