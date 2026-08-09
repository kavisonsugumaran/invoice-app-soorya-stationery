import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getAllCustomers, getCustomerById } from "./customers";

let nextInvoiceNo = 0;

async function createTestInvoice(
  customerId: string,
  status: "UNPAID" | "PAID" | "CANCELLED",
  total: number
) {
  nextInvoiceNo += 1;
  return prisma.invoice.create({
    data: {
      invoiceNo: `TEST-${nextInvoiceNo}`,
      status,
      customerId,
      subtotal: total,
      taxAmount: 0,
      total,
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("getCustomerById", () => {
  it("excludes cancelled invoices from totals and invoice count", async () => {
    const customer = await prisma.customer.create({ data: { name: "Test Customer" } });
    await createTestInvoice(customer.id, "PAID", 100);
    await createTestInvoice(customer.id, "UNPAID", 50);
    await createTestInvoice(customer.id, "CANCELLED", 9000);

    const result = await getCustomerById(customer.id);

    expect(result?.invoiceCount).toBe(2);
    expect(result?.totalInvoiced).toBe(150);
    expect(result?.totalPaid).toBe(100);
    expect(result?.totalUnpaid).toBe(50);
  });
});

describe("getAllCustomers", () => {
  it("excludes cancelled invoices from the list's totals and invoice count", async () => {
    const customer = await prisma.customer.create({ data: { name: "Test Customer" } });
    await createTestInvoice(customer.id, "PAID", 100);
    await createTestInvoice(customer.id, "CANCELLED", 9000);

    const { customers } = await getAllCustomers(1, customer.name);

    expect(customers).toHaveLength(1);
    expect(customers[0].invoiceCount).toBe(1);
    expect(customers[0].totalInvoiced).toBe(100);
  });
});
