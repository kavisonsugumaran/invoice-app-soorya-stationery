import { describe, expect, it } from "vitest";
import { normalizePhone, formatPhone, PHONE_LENGTH } from "./phone-format";

describe("normalizePhone", () => {
  it("strips spaces, dashes, and other non-digit characters", () => {
    expect(normalizePhone("077 123 4567")).toBe("0771234567");
    expect(normalizePhone("077-123-4567")).toBe("0771234567");
    expect(normalizePhone("(077) 123 4567")).toBe("0771234567");
  });

  it("leaves an already-clean number unchanged", () => {
    expect(normalizePhone("0771234567")).toBe("0771234567");
  });

  it("returns an empty string for an empty/whitespace input", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });
});

describe("formatPhone", () => {
  it("groups a standard 10-digit number as 3-3-4", () => {
    expect(formatPhone("0771234567")).toBe("077 123 4567");
  });

  it("normalizes before formatting, so a messily-typed number still groups correctly", () => {
    expect(formatPhone("077-123-4567")).toBe("077 123 4567");
  });

  it("returns an empty string for null/undefined/empty input", () => {
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
    expect(formatPhone("")).toBe("");
  });

  it("falls back to the raw value when it isn't a standard-length number (e.g. a multi-number business field)", () => {
    const multi = "+94 11 2437926, +94 11 5693018";
    expect(formatPhone(multi)).toBe(multi);
  });

  it(`falls back to the raw value when it doesn't have exactly ${PHONE_LENGTH} digits`, () => {
    expect(formatPhone("12345")).toBe("12345");
  });
});
