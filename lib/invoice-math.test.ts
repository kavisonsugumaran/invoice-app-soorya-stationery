import { describe, expect, it } from "vitest";
import { round2, computeLineTotal, computeInvoiceTotals, splitRupeesCents } from "./invoice-math";

describe("round2", () => {
  it("rounds to 2 decimal places", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round2(1)).toBe(1);
  });
});

describe("computeLineTotal", () => {
  it("multiplies price by quantity and rounds", () => {
    expect(computeLineTotal({ price: 250, quantity: 3 })).toBe(750);
    expect(computeLineTotal({ price: 19.999, quantity: 3 })).toBe(60);
  });
});

describe("computeInvoiceTotals", () => {
  const items = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 },
  ];

  it("computes subtotal with no tax", () => {
    const { subtotal, taxAmount, total } = computeInvoiceTotals(items, false, 0);
    expect(subtotal).toBe(250);
    expect(taxAmount).toBe(0);
    expect(total).toBe(250);
  });

  it("applies tax when enabled", () => {
    const { subtotal, taxAmount, total } = computeInvoiceTotals(items, true, 10);
    expect(subtotal).toBe(250);
    expect(taxAmount).toBe(25);
    expect(total).toBe(275);
  });

  it("ignores taxPercent when taxEnabled is false", () => {
    const { taxAmount, total } = computeInvoiceTotals(items, false, 50);
    expect(taxAmount).toBe(0);
    expect(total).toBe(250);
  });

  it("returns zero totals for an empty item list", () => {
    const { subtotal, taxAmount, total } = computeInvoiceTotals([], true, 10);
    expect(subtotal).toBe(0);
    expect(taxAmount).toBe(0);
    expect(total).toBe(0);
  });
});

describe("splitRupeesCents", () => {
  it("splits a whole-rupee amount with '00' cents", () => {
    expect(splitRupeesCents(150)).toEqual({ rupees: 150, cents: "00" });
  });

  it("splits a sub-1-rupee amount to 0 rupees and the correct cents", () => {
    expect(splitRupeesCents(0.5)).toEqual({ rupees: 0, cents: "50" });
  });

  it("pads single-digit cents to two digits", () => {
    expect(splitRupeesCents(10.05)).toEqual({ rupees: 10, cents: "05" });
  });

  it("does not leak floating-point remainder artifacts into the cents string", () => {
    // 10.10 - 10 in raw JS float math is 0.09999999999999964, not 0.10 —
    // this must still come out as "10", not "09" or "0999...".
    expect(splitRupeesCents(10.1)).toEqual({ rupees: 10, cents: "10" });
  });

  it("rounds the same way round2 does before splitting", () => {
    // round2(10.005) is 10.01 (see the round2 test above), so this must
    // split as 10 rupees, 1 cent — not 10.005 truncated straight to "00".
    expect(splitRupeesCents(10.005)).toEqual({ rupees: 10, cents: "01" });
  });

  it("treats a negative amount the same as its positive magnitude", () => {
    // Amounts are never negative in this codebase (validated positive at
    // input) — Math.abs is a defensive no-op, verified here rather than
    // left unverified.
    expect(splitRupeesCents(-10.5)).toEqual({ rupees: 10, cents: "50" });
  });
});
