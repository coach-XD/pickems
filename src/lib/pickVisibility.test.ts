import { describe, expect, it } from "vitest";
import { bracketStatus, canViewPicks } from "./pickVisibility";

describe("canViewPicks", () => {
  it("hides other players until the lock unless the stage is opened early", () => {
    expect(canViewPicks({ isOwner: false, isAdmin: false, slateLocked: false, showBeforeLock: false })).toBe(false);
    expect(canViewPicks({ isOwner: false, isAdmin: false, slateLocked: true, showBeforeLock: false })).toBe(true);
    expect(canViewPicks({ isOwner: false, isAdmin: false, slateLocked: false, showBeforeLock: true })).toBe(true);
  });

  it("always shows a player their own picks and lets an admin see everyone", () => {
    expect(canViewPicks({ isOwner: true, isAdmin: false, slateLocked: false, showBeforeLock: false })).toBe(true);
    expect(canViewPicks({ isOwner: false, isAdmin: true, slateLocked: false, showBeforeLock: false })).toBe(true);
  });
});

describe("bracketStatus", () => {
  it("distinguishes an empty, partial, and finished bracket", () => {
    expect(bracketStatus(0, 8)).toBe("empty");
    expect(bracketStatus(3, 8)).toBe("partial");
    expect(bracketStatus(8, 8)).toBe("complete");
  });
});
