import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getDashboardStats, getMonthlyRevenueTrend } from "./dashboard";

let nextInvoiceNo = 0;

async function createTestInvoice(status: "UNPAID" | "PAID" | "CANCELLED", total: number) {
  nextInvoiceNo += 1;
  return prisma.invoice.create({
    data: {
      invoiceNo: `TEST-${nextInvoiceNo}`,
      status,
      subtotal: total,
      taxAmount: 0,
      total,
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("getDashboardStats", () => {
  it("excludes cancelled invoices from totals and counts", async () => {
    await createTestInvoice("UNPAID", 100);
    await createTestInvoice("PAID", 200);
    await createTestInvoice("CANCELLED", 5000);

    const stats = await getDashboardStats();

    expect(stats.totalCount).toBe(2);
    expect(stats.totalInvoiced).toBe(300);
    expect(stats.unpaidTotal).toBe(100);
    expect(stats.paidTotal).toBe(200);
  });
});

describe("getMonthlyRevenueTrend", () => {
  it("excludes cancelled invoices from the revenue trend", async () => {
    await createTestInvoice("PAID", 100);
    await createTestInvoice("CANCELLED", 9000);

    const trend = await getMonthlyRevenueTrend(1);

    expect(trend[trend.length - 1].total).toBe(100);
  });
});
