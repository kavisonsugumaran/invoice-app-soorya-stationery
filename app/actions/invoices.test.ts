import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { createInvoice, updateInvoice, updateInvoiceStatus } from "./invoices";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

const baseInvoiceInput = {
  taxEnabled: false,
  taxPercent: 0,
  billTo: { name: "Test Customer", phone: "", address: "", taxId: "" },
  dateOfDelivery: "",
  placeOfSupply: "",
  modeOfPayment: "",
  additionalInfo: "",
  items: [{ reference: "", name: "Test Item", price: 100, quantity: 2 }],
};

async function createTestUser(role: "ADMIN" | "USER" = "USER") {
  return prisma.user.create({
    data: {
      username: `test-${role.toLowerCase()}-${Date.now()}-${Math.random()}`,
      name: `Test ${role}`,
      role,
      passwordHash: "not-a-real-hash",
    },
  });
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("createInvoice", () => {
  it("creates an invoice for an authenticated user and stamps createdByUserId", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const result = await createInvoice(baseInvoiceInput);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");

    const invoice = await prisma.invoice.findUnique({ where: { id: result.id } });
    expect(invoice?.createdByUserId).toBe(user.id);
    expect(invoice?.subtotal).toBe(200);
    expect(invoice?.total).toBe(200);
  });

  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await createInvoice(baseInvoiceInput);

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  // Gazette Extraordinary No. 2481/22: YYMMM_QQQQ_XXXXX, <=40 chars, no spaces.
  const GAZETTE_2481_22_FORMAT = /^\d{2}[A-Z]{3}_[A-Z0-9]+_\d{5}$/;

  it("generates an invoice number matching the Gazette 2481/22 format, falling back to the default unit code when no BusinessSettings row exists", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    // resetDb() (beforeEach) wipes BusinessSettings, so this exercises the
    // no-row fallback path.
    const result = await createInvoice(baseInvoiceInput);
    if (!result.success) throw new Error("expected success");

    expect(result.invoiceNo).toMatch(GAZETTE_2481_22_FORMAT);
    expect(result.invoiceNo.length).toBeLessThanOrEqual(40);
    expect(result.invoiceNo).not.toContain(" ");
    expect(result.invoiceNo).toContain("_SRY_");
  });

  it("uses the configured BusinessSettings.invoiceUnitCode when set", async () => {
    await prisma.businessSettings.create({
      data: { id: "default", businessName: "Test Shop", invoiceUnitCode: "TST" },
    });
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const result = await createInvoice(baseInvoiceInput);
    if (!result.success) throw new Error("expected success");

    expect(result.invoiceNo).toMatch(GAZETTE_2481_22_FORMAT);
    expect(result.invoiceNo).toContain("_TST_");
  });

  it("assigns sequential serials within the same month prefix", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const first = await createInvoice(baseInvoiceInput);
    const second = await createInvoice(baseInvoiceInput);
    if (!first.success || !second.success) throw new Error("expected success");

    const prefix = first.invoiceNo.slice(0, first.invoiceNo.lastIndexOf("_") + 1);
    expect(second.invoiceNo).toBe(`${prefix}00002`);
    expect(first.invoiceNo).toBe(`${prefix}00001`);
  });
});

describe("updateInvoice", () => {
  it("rejects a non-admin user — normal staff can't edit existing invoices", async () => {
    const staff = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });

    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateInvoice(created.id, baseInvoiceInput);

    expect(result).toEqual({ success: false, error: "Admins only." });
  });
});

describe("updateInvoiceStatus", () => {
  it("never allows a PAID invoice to be reverted to UNPAID", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const markPaid = await updateInvoiceStatus(created.id, "PAID");
    expect(markPaid.success).toBe(true);

    const revert = await updateInvoiceStatus(created.id, "UNPAID");
    expect(revert).toEqual({
      success: false,
      error: "A paid invoice cannot be marked as unpaid.",
    });

    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("PAID");
  });
});
