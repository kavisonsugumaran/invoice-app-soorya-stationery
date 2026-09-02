import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getAllInvoices, getAllSmallBills } from "./invoices";
import type { InvoiceStatus } from "@prisma/client";

async function createTestInvoice(
  invoiceNo: string,
  date: Date,
  taxEnabled = false,
  status: InvoiceStatus = "UNPAID"
) {
  return prisma.invoice.create({
    data: {
      invoiceNo,
      date,
      taxEnabled,
      status,
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

  it("filters by taxFolder", async () => {
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01"), true);
    await createTestInvoice("26AUG_SST_0002", new Date("2026-08-02"), false);
    await createTestInvoice("26AUG_SST_0003", new Date("2026-08-03"), true);

    const vatOnly = await getAllInvoices(1, undefined, "vat");
    const noVatOnly = await getAllInvoices(1, undefined, "no-vat");
    const all = await getAllInvoices(1, undefined, "all");

    expect(vatOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0003", "26AUG_SST_0001"]);
    expect(noVatOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0002"]);
    expect(all.totalCount).toBe(3);
  });

  it("excludes SMALL bills from the commercial invoice list", async () => {
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01"));
    await prisma.invoice.create({
      data: { invoiceNo: "E001", billType: "SMALL", subtotal: 0, taxAmount: 0, total: 0 },
    });

    const result = await getAllInvoices();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0001"]);
  });

  it("filters by status", async () => {
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01"), false, "PAID");
    await createTestInvoice("26AUG_SST_0002", new Date("2026-08-02"), false, "UNPAID");
    await createTestInvoice("26AUG_SST_0003", new Date("2026-08-03"), false, "CANCELLED");

    const paidOnly = await getAllInvoices(1, undefined, "all", "PAID");
    const unpaidOnly = await getAllInvoices(1, undefined, "all", "UNPAID");
    const cancelledOnly = await getAllInvoices(1, undefined, "all", "CANCELLED");
    const all = await getAllInvoices();

    expect(paidOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0001"]);
    expect(unpaidOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0002"]);
    expect(cancelledOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0003"]);
    expect(all.totalCount).toBe(3);
  });

  it("filters by date range, inclusive of the whole day on both ends", async () => {
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01T23:59:00Z"));
    await createTestInvoice("26AUG_SST_0002", new Date("2026-08-05T00:00:00Z"));
    await createTestInvoice("26AUG_SST_0003", new Date("2026-08-10T12:00:00Z"));

    const inRange = await getAllInvoices(1, undefined, "all", undefined, "2026-08-01", "2026-08-05");
    const fromOnly = await getAllInvoices(1, undefined, "all", undefined, "2026-08-05");
    const toOnly = await getAllInvoices(1, undefined, "all", undefined, undefined, "2026-08-01");

    expect(inRange.invoices.map((i) => i.invoiceNo).sort()).toEqual([
      "26AUG_SST_0001",
      "26AUG_SST_0002",
    ]);
    expect(fromOnly.invoices.map((i) => i.invoiceNo).sort()).toEqual([
      "26AUG_SST_0002",
      "26AUG_SST_0003",
    ]);
    expect(toOnly.invoices.map((i) => i.invoiceNo)).toEqual(["26AUG_SST_0001"]);
  });
});

describe("getAllSmallBills", () => {
  it("only returns billType SMALL invoices, excluding commercial ones", async () => {
    await createTestInvoice("26AUG_SST_0001", new Date("2026-08-01")); // billType defaults COMMERCIAL
    await prisma.invoice.create({
      data: { invoiceNo: "E001", billType: "SMALL", subtotal: 100, taxAmount: 0, total: 100 },
    });

    const result = await getAllSmallBills();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["E001"]);
  });

  it("sorts by numeric suffix descending, newest first", async () => {
    await prisma.invoice.createMany({
      data: [
        { invoiceNo: "E001", billType: "SMALL", subtotal: 0, taxAmount: 0, total: 0 },
        { invoiceNo: "E010", billType: "SMALL", subtotal: 0, taxAmount: 0, total: 0 },
        { invoiceNo: "E002", billType: "SMALL", subtotal: 0, taxAmount: 0, total: 0 },
      ],
    });

    const result = await getAllSmallBills();

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["E010", "E002", "E001"]);
  });

  it("supports a customer-name/invoiceNo search query", async () => {
    const customer = await prisma.customer.create({ data: { name: "Searchable Customer" } });
    await prisma.invoice.create({
      data: {
        invoiceNo: "E001",
        billType: "SMALL",
        customerId: customer.id,
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      },
    });
    await prisma.invoice.create({
      data: { invoiceNo: "E002", billType: "SMALL", subtotal: 0, taxAmount: 0, total: 0 },
    });

    const result = await getAllSmallBills(1, "Searchable");

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["E001"]);
  });

  it("filters by status", async () => {
    await prisma.invoice.createMany({
      data: [
        { invoiceNo: "E001", billType: "SMALL", status: "PAID", subtotal: 0, taxAmount: 0, total: 0 },
        { invoiceNo: "E002", billType: "SMALL", status: "UNPAID", subtotal: 0, taxAmount: 0, total: 0 },
      ],
    });

    const paidOnly = await getAllSmallBills(1, undefined, "PAID");

    expect(paidOnly.invoices.map((i) => i.invoiceNo)).toEqual(["E001"]);
  });

  it("filters by date range", async () => {
    await prisma.invoice.createMany({
      data: [
        {
          invoiceNo: "E001",
          billType: "SMALL",
          date: new Date("2026-08-01"),
          subtotal: 0,
          taxAmount: 0,
          total: 0,
        },
        {
          invoiceNo: "E002",
          billType: "SMALL",
          date: new Date("2026-08-10"),
          subtotal: 0,
          taxAmount: 0,
          total: 0,
        },
      ],
    });

    const result = await getAllSmallBills(1, undefined, undefined, "2026-08-05");

    expect(result.invoices.map((i) => i.invoiceNo)).toEqual(["E002"]);
  });
});
