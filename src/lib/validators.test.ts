import { describe, expect, it } from "vitest";
import { logoUrlSchema } from "./validators";

describe("logoUrlSchema", () => {
  it("accepts a blank value, https, and an uploaded image", () => {
    expect(logoUrlSchema.parse("")).toBeNull();
    expect(logoUrlSchema.parse("https://cdn.example/logo.png")).toBe("https://cdn.example/logo.png");
    expect(logoUrlSchema.parse("data:image/png;base64,aaaa")).toBe("data:image/png;base64,aaaa");
  });

  it("rejects a page path and http", () => {
    expect(logoUrlSchema.safeParse("/logos/nip.png").success).toBe(false);
    expect(logoUrlSchema.safeParse("http://cdn.example/logo.png").success).toBe(false);
  });
});
