import { describe, expect, it } from "vitest";
import { chooseBookPrice, matchOurTeams } from "./parse";
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

  it("prefers Pinnacle over a shorter-priced book", () => {
    const chosen = chooseBookPrice({
      bookmakers: {
        bet365: { markets: { "171": { outcomes: { a: { price: 1.4 }, b: { price: 2.8 } } } } },
        pinnacle: { markets: { "171": { outcomes: { a: { price: 1.44 }, b: { price: 2.9 } } } } },
      },
    });
    expect(chosen?.bookmaker).toBe("pinnacle");
    expect(chosen?.price1).toBe(1.44);
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
