import { describe, expect, it } from "vitest";
import { STAGE1_TEAMS } from "@/db/stage1";
import sample from "./fixtures/pgl-singapore-round1.json";
import { listFixtureParticipants, listFixtures, listOddsRows, mapParticipants, matchOurTeams, priceMappedFixtures, winnerPrices } from "./parse";
import { eloWinProbability, fairPercents, namesMatch, projectedPrice } from "./price";

describe("projected VRS prices", () => {
  it("shrinks the Elo gap and adds a five percent margin", () => {
    expect(eloWinProbability(1548, 1406)).toBeCloseTo(0.6201, 3);
    const heroic = projectedPrice(1548, 1406);
    expect(heroic.percent).toBe(62);
    expect(heroic.odds).toBe(1.54);
    expect(projectedPrice(1500, 1500)).toEqual({ odds: 1.9, percent: 50 });
  });
});

describe("book prices", () => {
  it("removes the overround from a real line", () => {
    expect(fairPercents(1.44, 2.9)).toEqual({ a: 67, b: 33 });
  });

  it("reads the bet365 match-winner market and skips an inactive one", () => {
    const fixture = {
      bookmakerOdds: {
        bet365: {
          markets: {
            "171": {
              suspended: false,
              outcomes: {
                "171": { active: true, players: { "0": { price: 1.37, active: true } } },
                "172": { active: true, players: { "0": { price: 2.75, active: true } } },
              },
            },
          },
        },
      },
    };
    expect(winnerPrices(fixture, "bet365")).toEqual({ price1: 1.37, price2: 2.75 });
    const inactive = structuredClone(fixture);
    inactive.bookmakerOdds.bet365.markets["171"].outcomes["171"].active = false;
    expect(winnerPrices(inactive, "bet365")).toBeNull();
    const suspended = structuredClone(fixture);
    suspended.bookmakerOdds.bet365.markets["171"].suspended = true;
    expect(winnerPrices(suspended, "bet365")).toBeNull();
  });

  it("matches every posted PGL Singapore Round 1 name to Stage 1", () => {
    const pairs = [
      ["Heroic", "Imperial eSports", "HEROIC", "Imperial"],
      ["9Z Team", "Lynn Vision Gaming", "9z", "Lynn Vision"],
      ["Ninjas In Pyjamas", "M80", "Ninjas in Pyjamas", "M80"],
      ["100 Thieves", "Chinggis Warriors", "100 Thieves", "Chinggis Warriors"],
      ["Parivision", "Dendele CS", "PARIVISION", "DENDELE"],
      ["Team Liquid", "BC.Game eSports", "Liquid", "BC.Game (GOSH)"],
      ["Eternal Fire", "Flyquest", "Eternal Fire", "FlyQuest"],
      ["Faze Clan", "Wildcard Gaming", "FaZe", "Wildcard"],
    ] as const;
    for (const [left, right, ourLeft, ourRight] of pairs) {
      const matched = matchOurTeams({ fixtureId: left, participant1Name: left, participant2Name: right }, STAGE1_TEAMS);
      expect(matched?.team1.name).toBe(ourLeft);
      expect(matched?.team2.name).toBe(ourRight);
    }
    expect(namesMatch("BC.Game (GOSH)", "GOSH")).toBe(true);
    expect(namesMatch("PARIVISION", "PVISION")).toBe(true);
  });

  it("prices the live unibet rows by participant id", () => {
    expect(listFixtures(sample.odds)).toEqual([]);
    expect(listOddsRows(sample.odds)).toHaveLength(8);
    for (const row of sample.odds) {
      expect(row).not.toHaveProperty("participant1Name");
      expect(row).not.toHaveProperty("participant2Name");
    }
    const teams = STAGE1_TEAMS.map((team) => ({ id: team.name, name: team.name }));
    const mapping = mapParticipants(listFixtureParticipants(sample.fixtures), teams);
    expect(mapping.size).toBe(16);
    expect(priceMappedFixtures(sample.odds, "unibet", new Map())).toEqual([]);
    expect(
      priceMappedFixtures(sample.odds, "unibet", mapping).map((row) => ({
        team1: row.team1.name,
        team2: row.team2.name,
        price1: row.price1,
        price2: row.price2,
      })),
    ).toEqual([
      { team1: "HEROIC", team2: "Imperial", price1: 1.41, price2: 2.8 },
      { team1: "9z", team2: "Lynn Vision", price1: 1.52, price2: 2.48 },
      { team1: "Ninjas in Pyjamas", team2: "M80", price1: 1.6, price2: 2.28 },
      { team1: "100 Thieves", team2: "Chinggis Warriors", price1: 1.11, price2: 5.75 },
      { team1: "PARIVISION", team2: "DENDELE", price1: 1.43, price2: 2.75 },
      { team1: "Liquid", team2: "BC.Game (GOSH)", price1: 1.7, price2: 2.1 },
      { team1: "Eternal Fire", team2: "FlyQuest", price1: 1.73, price2: 2.06 },
      { team1: "FaZe", team2: "Wildcard", price1: 1.45, price2: 2.65 },
    ]);
  });

  it("matches GOSH, PVISION, and 100T to our names", () => {
    const teams = [{ name: "BC.Game (GOSH)" }, { name: "PARIVISION" }, { name: "100 Thieves" }, { name: "Liquid" }];
    expect(namesMatch("BC.Game (GOSH)", "GOSH")).toBe(true);
    expect(namesMatch("PARIVISION", "PVISION")).toBe(true);
    expect(namesMatch("100 Thieves", "100T")).toBe(true);
    expect(matchOurTeams({ fixtureId: "1", participant1Name: "GOSH", participant2Name: "Liquid" }, teams)?.team1.name).toBe(
      "BC.Game (GOSH)",
    );
  });
});
