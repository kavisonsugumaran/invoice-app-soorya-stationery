import { describe, expect, it } from "vitest";
import { formatCurrency } from "./currency";

describe("formatCurrency", () => {
  it("prefixes with LKR and always shows 2 decimal places", () => {
    expect(formatCurrency(1000)).toBe("LKR 1,000.00");
    expect(formatCurrency(0)).toBe("LKR 0.00");
    expect(formatCurrency(1234.5)).toBe("LKR 1,234.50");
  });

  it("adds thousands separators for large values", () => {
    expect(formatCurrency(1234567.89)).toBe("LKR 1,234,567.89");
  });
});
