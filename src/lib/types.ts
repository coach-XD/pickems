export type Slot = "perfect" | "winless" | "advance";
export type SeriesFormat = "bo1" | "bo3";
export type TeamStatus = "active" | "advanced" | "eliminated";

export const SLOT_LIMITS: Record<Slot, number> = {
  perfect: 2,
  winless: 2,
  advance: 6,
};

export const SLOT_LABEL: Record<Slot, string> = {
  perfect: "3-0",
  winless: "0-3",
  advance: "Advances",
};

export const SLOT_POINTS: Record<Slot, number> = {
  perfect: 5,
  winless: 5,
  advance: 2,
};
