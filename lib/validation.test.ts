import { describe, expect, it } from "vitest";
import { tinError } from "./validation";

describe("tinError", () => {
  it("allows a blank value — TIN is optional", () => {
    expect(tinError("")).toBeNull();
    expect(tinError("   ")).toBeNull();
  });

  it("accepts exactly 9 digits", () => {
    expect(tinError("123456789")).toBeNull();
  });

  it("rejects non-numeric characters", () => {
    expect(tinError("11C011096")).toBe("TIN must be exactly 9 digits.");
  });

  it("rejects the wrong length", () => {
    expect(tinError("12345")).toBe("TIN must be exactly 9 digits.");
    expect(tinError("1234567890")).toBe("TIN must be exactly 9 digits.");
  });
});
