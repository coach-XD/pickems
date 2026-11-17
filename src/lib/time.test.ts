import { describe, expect, it } from "vitest";
import { isLocked, placementLock } from "./time";

describe("locks", () => {
  const start = new Date("2026-11-24T04:00:00.000Z");

  it("locks at one hour before the start and not a millisecond earlier", () => {
    expect(isLocked(start, new Date("2026-11-24T03:00:00.000Z"))).toBe(true);
    expect(isLocked(start, new Date("2026-11-24T02:59:59.999Z"))).toBe(false);
  });

  it("uses the earliest match for the stage slate", () => {
    const lock = placementLock(
      [new Date("2026-11-24T07:00:00.000Z"), new Date("2026-11-24T04:00:00.000Z")],
      new Date("2026-11-24T12:00:00.000Z"),
    );
    expect(lock.toISOString()).toBe("2026-11-24T03:00:00.000Z");
  });
});
