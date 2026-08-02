import { describe, expect, it } from "vitest";
import { formatInvoiceDate } from "./date-format";

describe("formatInvoiceDate", () => {
  it("formats as zero-padded MM/DD/YYYY per Gazette 2481/22", () => {
    expect(formatInvoiceDate(new Date("2026-07-31T12:00:00Z"))).toBe("07/31/2026");
  });

  it("zero-pads single-digit months and days", () => {
    expect(formatInvoiceDate(new Date("2026-01-05T12:00:00Z"))).toBe("01/05/2026");
  });
});
