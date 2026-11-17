/**
 * Stage 1 of the PGL Singapore 2026 CS2 Major (24–27 Nov 2026).
 *
 * Seeds are the opening-round seeds implied by Valve's 1-vs-9, 2-vs-10 …
 * pairing, which is also the published 2 Nov 2026 VRS seed list. They are
 * NOT a sort of the left-hand world-rank badge. `worldRank` is that left
 * badge. `otherRank` is the orange badge on the same card. Both are stored
 * so an admin can correct the seed without losing the displayed ranks.
 *
 * Round 1 times are the published slate (05:00–08:00 CET = 04:00–07:00 UTC
 * on 24 Nov 2026). They stay editable in admin.
 */

export type Stage1Team = {
  name: string;
  shortName: string;
  region: "Europe" | "Americas" | "Asia";
  seed: number;
  worldRank: number;
  otherRank: number;
};

export const STAGE1_SLUG = "stage-1";

export const STAGE1_TEAMS: Stage1Team[] = [
  { name: "Ninjas in Pyjamas", shortName: "NiP", region: "Europe", seed: 1, worldRank: 18, otherRank: 18 },
  { name: "PARIVISION", shortName: "PARI", region: "Europe", seed: 2, worldRank: 13, otherRank: 14 },
  { name: "HEROIC", shortName: "HEROIC", region: "Europe", seed: 3, worldRank: 23, otherRank: 20 },
  { name: "FaZe", shortName: "FaZe", region: "Europe", seed: 4, worldRank: 19, otherRank: 23 },
  { name: "Liquid", shortName: "Liquid", region: "Americas", seed: 5, worldRank: 16, otherRank: 15 },
  { name: "Eternal Fire", shortName: "EF", region: "Europe", seed: 6, worldRank: 22, otherRank: 24 },
  { name: "100 Thieves", shortName: "100T", region: "Europe", seed: 7, worldRank: 29, otherRank: 17 },
  { name: "9z", shortName: "9z", region: "Americas", seed: 8, worldRank: 21, otherRank: 29 },
  { name: "M80", shortName: "M80", region: "Americas", seed: 9, worldRank: 24, otherRank: 27 },
  { name: "DENDELE", shortName: "DEND", region: "Americas", seed: 10, worldRank: 33, otherRank: 28 },
  { name: "Imperial", shortName: "IMP", region: "Americas", seed: 11, worldRank: 48, otherRank: 34 },
  { name: "Wildcard", shortName: "WC", region: "Americas", seed: 12, worldRank: 42, otherRank: 39 },
  { name: "BC.Game", shortName: "BC", region: "Asia", seed: 13, worldRank: 46, otherRank: 46 },
  { name: "FlyQuest", shortName: "FQ", region: "Asia", seed: 14, worldRank: 58, otherRank: 43 },
  { name: "Chinggis Warriors", shortName: "CW", region: "Asia", seed: 15, worldRank: 59, otherRank: 53 },
  { name: "Lynn Vision", shortName: "LV", region: "Asia", seed: 16, worldRank: 44, otherRank: 57 },
];

export const STAGE1_MATCHES: Array<{
  round: number;
  format: "bo1";
  seedA: number;
  seedB: number;
  scheduledAt: string;
}> = [
  { round: 1, format: "bo1", seedA: 3, seedB: 11, scheduledAt: "2026-11-24T04:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 8, seedB: 16, scheduledAt: "2026-11-24T04:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 1, seedB: 9, scheduledAt: "2026-11-24T05:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 7, seedB: 15, scheduledAt: "2026-11-24T05:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 5, seedB: 13, scheduledAt: "2026-11-24T06:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 2, seedB: 10, scheduledAt: "2026-11-24T06:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 4, seedB: 12, scheduledAt: "2026-11-24T07:00:00.000Z" },
  { round: 1, format: "bo1", seedA: 6, seedB: 14, scheduledAt: "2026-11-24T07:00:00.000Z" },
];

export const STAGE1_START = "2026-11-24T04:00:00.000Z";
export const STAGE1_END = "2026-11-27T16:00:00.000Z";
