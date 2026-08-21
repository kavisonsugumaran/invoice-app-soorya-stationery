import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getAllInvoices } from "./invoices";

async function createTestInvoice(invoiceNo: string, date: Date) {
  return prisma.invoice.create({
    data: {
      invoiceNo,
      date,
      subtotal: 100,
      taxAmount: 0,
      total: 100,
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("getAllInvoices", () => {
  it("sorts by the invoiceNo's own encoded month/serial, not by the date field", async () => {
    // A backfilled July invoice whose Date of Invoice field was never
    // corrected away from today (see the Aug 2026 backfill discussion) —
    // its date is misleadingly later than an August invoice's date, but it
    // must still sort below every August invoice.
    await createTestInvoice("26JUL_SST_0226", new Date("2026-08-20"));
    await createTestInvoice("26AUG_SST_0150", new Date("2026-08-01"));

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0150", "26JUL_SST_0226"]);
  });

  it("orders months chronologically, not alphabetically by abbreviation", async () => {
    // Alphabetically "SEP" < "AUG" and "JUN" < "JUL", both backwards from
    // calendar order — this only passes if the month abbreviation is
    // converted to a number before sorting.
    await createTestInvoice("26SEP_SST_0001", new Date("2026-09-01"));
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01"));
    await createTestInvoice("26JUL_SST_0001", new Date("2026-07-01"));
    await createTestInvoice("26JUN_SST_0001", new Date("2026-06-01"));

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual([
      "26SEP_SST_0001",
      "26AUG_SST_0001",
      "26JUL_SST_0001",
      "26JUN_SST_0001",
    ]);
  });

  it("orders a later year above an earlier year even in an earlier month", async () => {
    await createTestInvoice("26JAN_SST_0001", new Date("2026-01-01"));
    await createTestInvoice("25DEC_SST_0001", new Date("2025-12-01"));

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["26JAN_SST_0001", "25DEC_SST_0001"]);
  });

  it("within the same month, orders higher serials above lower ones", async () => {
    await createTestInvoice("26AUG_SST_0003", new Date("2026-08-03"));
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01"));
    await createTestInvoice("26AUG_SST_0002", new Date("2026-08-02"));

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual([
      "26AUG_SST_0003",
      "26AUG_SST_0002",
      "26AUG_SST_0001",
    ]);
  });

  it("old-format INV-YYYYMMDD-NN invoices sort by their own encoded date too", async () => {
    await createTestInvoice("INV-20260215-02", new Date("2026-02-15"));
    await createTestInvoice("INV-20260215-01", new Date("2026-02-15"));
    await createTestInvoice("INV-20260101-01", new Date("2026-01-01"));

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual([
      "INV-20260215-02",
      "INV-20260215-01",
      "INV-20260101-01",
    ]);
  });
});
