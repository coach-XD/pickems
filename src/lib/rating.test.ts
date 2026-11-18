import { describe, expect, it } from "vitest";
import { RATING_BANDS, ratingTone } from "./rating";

describe("rating bands", () => {
  it("keeps the thresholds in one constant", () => {
    expect(RATING_BANDS).toEqual({ redMax: 0.96, yellowMax: 1.05 });
  });

  it("colors red through 0.96, yellow from 0.97 to 1.05, and green above", () => {
    expect(ratingTone(0.92)).toBe("red");
    expect(ratingTone(RATING_BANDS.redMax)).toBe("red");
    expect(ratingTone(0.97)).toBe("yellow");
    expect(ratingTone(1)).toBe("yellow");
    expect(ratingTone(RATING_BANDS.yellowMax)).toBe("yellow");
    expect(ratingTone(1.06)).toBe("green");
    expect(ratingTone(1.23)).toBe("green");
    expect(ratingTone(null)).toBe("muted");
    expect(ratingTone(undefined)).toBe("muted");
  });
});
