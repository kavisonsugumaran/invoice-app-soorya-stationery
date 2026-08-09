import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getAllProducts, getProductById } from "./products";

let nextInvoiceNo = 0;

async function createTestInvoiceWithItem(
  productId: string,
  status: "UNPAID" | "PAID" | "CANCELLED",
  lineTotal: number
) {
  nextInvoiceNo += 1;
  return prisma.invoice.create({
    data: {
      invoiceNo: `TEST-${nextInvoiceNo}`,
      status,
      subtotal: lineTotal,
      taxAmount: 0,
      total: lineTotal,
      items: {
        create: [{ name: "Test Item", price: lineTotal, quantity: 1, lineTotal, productId }],
      },
    },
  });
}

beforeEach(async () => {
  await resetDb();
});

describe("getProductById", () => {
  it("excludes line items on cancelled invoices from times-used and revenue", async () => {
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Test Product", price: 100 },
    });
    await createTestInvoiceWithItem(product.id, "PAID", 100);
    await createTestInvoiceWithItem(product.id, "CANCELLED", 9000);

    const result = await getProductById(product.id);

    expect(result?.timesUsed).toBe(1);
    expect(result?.totalRevenue).toBe(100);
  });
});

describe("getAllProducts", () => {
  it("excludes line items on cancelled invoices from the list's times-used and revenue", async () => {
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Test Product", price: 100 },
    });
    await createTestInvoiceWithItem(product.id, "PAID", 100);
    await createTestInvoiceWithItem(product.id, "CANCELLED", 9000);

    const { products } = await getAllProducts(1, product.name);

    expect(products).toHaveLength(1);
    expect(products[0].timesUsed).toBe(1);
    expect(products[0].totalRevenue).toBe(100);
  });
});
