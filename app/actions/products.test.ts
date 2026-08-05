import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { updateProduct } from "./products";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

async function loginAsStaff() {
  const user = await prisma.user.create({
    data: {
      username: `test-user-${Date.now()}-${Math.random()}`,
      name: "Test User",
      role: "USER",
      passwordHash: "not-a-real-hash",
    },
  });
  mockedGetCurrentUser.mockResolvedValue({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("updateProduct", () => {
  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "Paper", price: 100 });

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  it("renames the product in place, keeping the same id and reference", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "Copy Paper", price: 100 });

    expect(result).toEqual({ success: true });
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated).toMatchObject({ id: product.id, reference: "P-0001", name: "Copy Paper", price: 100 });
    expect(await prisma.product.count()).toBe(1);
  });

  it("updates the price in place too", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "Paper", price: 150 });

    expect(result).toEqual({ success: true });
    const updated = await prisma.product.findUnique({ where: { id: product.id } });
    expect(updated?.price).toBe(150);
  });

  it("rejects an empty name", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "   ", price: 100 });

    expect(result).toEqual({ success: false, error: "Product name is required." });
  });

  it("rejects renaming to a name that already exists on a different product", async () => {
    await loginAsStaff();
    await prisma.product.create({ data: { reference: "P-0001", name: "Ruler", price: 50 } });
    const product = await prisma.product.create({ data: { reference: "P-0002", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "Ruler", price: 100 });

    expect(result).toEqual({
      success: false,
      error: "A product with this name already exists: Ruler (P-0001).",
    });
  });

  it("allows saving with the product's own unchanged name (not flagged as a duplicate of itself)", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });

    const result = await updateProduct(product.id, { name: "Paper", price: 120 });

    expect(result).toEqual({ success: true });
  });

  it("past invoice items are unaffected by a rename — they keep their saved snapshot", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({ data: { reference: "P-0001", name: "Paper", price: 100 } });
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo: "TEST-0001",
        subtotal: 100,
        taxAmount: 0,
        total: 100,
        items: {
          create: [
            { reference: "P-0001", name: "Paper", price: 100, quantity: 1, lineTotal: 100, productId: product.id },
          ],
        },
      },
    });

    await updateProduct(product.id, { name: "Copy Paper", price: 150 });

    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: invoice.id } });
    expect(items[0]).toMatchObject({ name: "Paper", price: 100 });
  });
});
