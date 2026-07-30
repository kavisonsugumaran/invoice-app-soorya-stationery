import { describe, expect, it } from "vitest";
import { round2, computeLineTotal, computeInvoiceTotals } from "./invoice-math";

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
