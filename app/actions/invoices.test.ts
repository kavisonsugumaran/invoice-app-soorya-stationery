import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import {
  createInvoice,
  updateInvoice,
  updateInvoiceNumber,
  updateInvoiceStatus,
  revertInvoiceToUnpaid,
  cancelInvoice,
} from "./invoices";

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

async function createTestUserWithPassword(password: string, role: "ADMIN" | "USER" = "USER") {
  return prisma.user.create({
    data: {
      username: `test-${role.toLowerCase()}-${Date.now()}-${Math.random()}`,
      name: `Test ${role}`,
      role,
      passwordHash: await bcrypt.hash(password, 10),
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
    expect(result.invoiceNo).toContain("_SST_");
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

  it("sets the invoice date from input.date, defaulting to now when omitted", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });

    const withDate = await createInvoice({ ...baseInvoiceInput, date: "2026-03-15" });
    if (!withDate.success) throw new Error("expected success");
    const invoice = await prisma.invoice.findUnique({ where: { id: withDate.id } });
    expect(invoice?.date.toISOString().slice(0, 10)).toBe("2026-03-15");

    const withoutDate = await createInvoice(baseInvoiceInput);
    if (!withoutDate.success) throw new Error("expected success");
    const invoice2 = await prisma.invoice.findUnique({ where: { id: withoutDate.id } });
    const today = new Date().toISOString().slice(0, 10);
    expect(invoice2?.date.toISOString().slice(0, 10)).toBe(today);
  });
});

// TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
// Remove this whole describe block once the feature it covers is removed.
describe("createInvoice — temporary Aug 2026 backfill support", () => {
  async function loginAsStaff() {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
  }

  it("uses the client-typed invoice number verbatim for a backfilled invoice, never a Gazette-format number", async () => {
    await loginAsStaff();

    const result = await createInvoice({
      ...baseInvoiceInput,
      isOldInvoice: true,
      oldInvoiceNo: "26JUL_SST_00150",
    });

    if (!result.success) throw new Error("expected success");
    expect(result.invoiceNo).toBe("26JUL_SST_00150");
  });

  it("requires oldInvoiceNo when isOldInvoice is true", async () => {
    await loginAsStaff();

    const result = await createInvoice({ ...baseInvoiceInput, isOldInvoice: true });

    expect(result.success).toBe(false);
  });

  it("rejects a duplicate oldInvoiceNo with a friendly error instead of throwing", async () => {
    await loginAsStaff();

    await createInvoice({ ...baseInvoiceInput, isOldInvoice: true, oldInvoiceNo: "DUPLICATE-001" });
    const result = await createInvoice({
      ...baseInvoiceInput,
      isOldInvoice: true,
      oldInvoiceNo: "DUPLICATE-001",
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/already in use/i);
  });

  it("backfilled invoices never advance the real Gazette counter", async () => {
    await loginAsStaff();

    await createInvoice({ ...baseInvoiceInput, isOldInvoice: true, oldInvoiceNo: "OLD-A" });
    await createInvoice({ ...baseInvoiceInput, isOldInvoice: true, oldInvoiceNo: "OLD-B" });
    const real = await createInvoice(baseInvoiceInput);

    if (!real.success) throw new Error("expected success");
    expect(real.invoiceNo).toMatch(/_00001$/);
  });

  it("applies the serial floor only when BusinessSettings has it explicitly set, and only in August", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00Z"));
    try {
      await prisma.businessSettings.create({
        data: {
          id: "default",
          businessName: "Test Shop",
          tempInvoiceSerialFloorAugust2026: 422,
        },
      });
      await loginAsStaff();

      const first = await createInvoice(baseInvoiceInput);
      const second = await createInvoice(baseInvoiceInput);

      if (!first.success || !second.success) throw new Error("expected success");
      expect(first.invoiceNo).toBe("26AUG_SST_00422");
      expect(second.invoiceNo).toBe("26AUG_SST_00423");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps assigning correct sequential numbers well past the floor, with pre-existing rows creating a gap (regression: a row-count-based base would run out of unique-number retries and start failing)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00Z"));
    try {
      // Mirrors production's real shape: a handful of pre-existing invoices
      // (from before the floor was set) at low numbers, then a floor that
      // jumps far ahead of that count.
      for (let i = 1; i <= 18; i++) {
        await prisma.invoice.create({
          data: {
            invoiceNo: `26AUG_SST_${String(i).padStart(5, "0")}`,
            subtotal: 0,
            taxAmount: 0,
            total: 0,
          },
        });
      }
      await prisma.businessSettings.create({
        data: {
          id: "default",
          businessName: "Test Shop",
          tempInvoiceSerialFloorAugust2026: 422,
        },
      });
      await loginAsStaff();

      const invoiceNos: string[] = [];
      for (let i = 0; i < 8; i++) {
        const result = await createInvoice(baseInvoiceInput);
        if (!result.success) throw new Error(`invoice ${i + 1} failed: ${result.error}`);
        invoiceNos.push(result.invoiceNo);
      }

      expect(invoiceNos).toEqual([
        "26AUG_SST_00422",
        "26AUG_SST_00423",
        "26AUG_SST_00424",
        "26AUG_SST_00425",
        "26AUG_SST_00426",
        "26AUG_SST_00427",
        "26AUG_SST_00428",
        "26AUG_SST_00429",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not apply any floor when the field is left unset", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T10:00:00Z"));
    try {
      await loginAsStaff();

      const result = await createInvoice(baseInvoiceInput);

      if (!result.success) throw new Error("expected success");
      expect(result.invoiceNo).toBe("26AUG_SST_00001");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never lets the floor leak into September, even if the field is still set", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T10:00:00Z"));
    try {
      await prisma.businessSettings.create({
        data: {
          id: "default",
          businessName: "Test Shop",
          tempInvoiceSerialFloorAugust2026: 422,
        },
      });
      await loginAsStaff();

      const result = await createInvoice(baseInvoiceInput);

      if (!result.success) throw new Error("expected success");
      expect(result.invoiceNo).toBe("26SEP_SST_00001");
    } finally {
      vi.useRealTimers();
    }
  });
});

// TEMPORARY (Aug 2026 backfill — see memory/temp_invoice_backfill_2026_08.md).
// Remove this whole describe block once the feature it covers is removed.
describe("updateInvoiceNumber — temporary Aug 2026 backfill support", () => {
  async function createTestInvoice(invoiceNo: string) {
    return prisma.invoice.create({
      data: { invoiceNo, subtotal: 0, taxAmount: 0, total: 0 },
    });
  }

  it("lets a non-admin staff member correct an invoice number", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
    const invoice = await createTestInvoice("OLD-00011");

    const result = await updateInvoiceNumber(invoice.id, "26JUL_SST_00042");

    expect(result.success).toBe(true);
    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(updated?.invoiceNo).toBe("26JUL_SST_00042");
  });

  it("rejects a blank invoice number", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
    const invoice = await createTestInvoice("OLD-00012");

    const result = await updateInvoiceNumber(invoice.id, "   ");

    expect(result.success).toBe(false);
  });

  it("returns a friendly error on a duplicate invoice number instead of throwing", async () => {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
    await createTestInvoice("TAKEN-001");
    const invoice = await createTestInvoice("OLD-00013");

    const result = await updateInvoiceNumber(invoice.id, "TAKEN-001");

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error).toMatch(/already in use/i);
  });

  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);
    const invoice = await createTestInvoice("OLD-00014");

    const result = await updateInvoiceNumber(invoice.id, "26JUL_SST_00099");

    expect(result.success).toBe(false);
  });
});

describe("resolveInvoiceItems (via createInvoice)", () => {
  async function loginAsStaff() {
    const user = await createTestUser("USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    });
  }

  it("reuses a linked product when the invoice price matches its catalog price", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Ruler", price: 50 },
    });

    const result = await createInvoice({
      ...baseInvoiceInput,
      items: [{ reference: product.reference, name: "Ruler", price: 50, quantity: 1, productId: product.id }],
    });
    if (!result.success) throw new Error("expected success");

    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: result.id } });
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(product.id);
    expect(items[0].reference).toBe("P-0001");
    expect(await prisma.product.count()).toBe(1);
  });

  it("creates a new product instead of overwriting the catalog price when a linked row's price is edited", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Ruler", price: 50 },
    });

    const result = await createInvoice({
      ...baseInvoiceInput,
      items: [{ reference: product.reference, name: "Ruler", price: 75, quantity: 1, productId: product.id }],
    });
    if (!result.success) throw new Error("expected success");

    // The original catalog product must be untouched.
    const original = await prisma.product.findUnique({ where: { id: product.id } });
    expect(original?.price).toBe(50);

    // The invoice item links to a different, newly created product.
    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: result.id } });
    expect(items[0].productId).not.toBe(product.id);
    expect(await prisma.product.count()).toBe(2);

    const newProduct = await prisma.product.findUnique({ where: { id: items[0].productId! } });
    expect(newProduct).toMatchObject({ name: "Ruler", price: 75 });
  });

  it("reuses a product found by exact name match (no productId) when the price matches", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Ruler", price: 50 },
    });

    const result = await createInvoice({
      ...baseInvoiceInput,
      items: [{ reference: "", name: "Ruler", price: 50, quantity: 1 }],
    });
    if (!result.success) throw new Error("expected success");

    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: result.id } });
    expect(items[0].productId).toBe(product.id);
    expect(await prisma.product.count()).toBe(1);
  });

  it("creates a new product when a typed name matches an existing product but the price differs", async () => {
    await loginAsStaff();
    const product = await prisma.product.create({
      data: { reference: "P-0001", name: "Ruler", price: 50 },
    });

    const result = await createInvoice({
      ...baseInvoiceInput,
      items: [{ reference: "", name: "Ruler", price: 65, quantity: 1 }],
    });
    if (!result.success) throw new Error("expected success");

    const original = await prisma.product.findUnique({ where: { id: product.id } });
    expect(original?.price).toBe(50);

    const items = await prisma.invoiceItem.findMany({ where: { invoiceId: result.id } });
    expect(items[0].productId).not.toBe(product.id);
    expect(await prisma.product.count()).toBe(2);
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

  it("updates the invoice date when one is provided", async () => {
    const admin = await createTestUser("ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice({ ...baseInvoiceInput, date: "2026-03-15" });
    if (!created.success) throw new Error("setup failed");

    const result = await updateInvoice(created.id, { ...baseInvoiceInput, date: "2026-04-20" });

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.date.toISOString().slice(0, 10)).toBe("2026-04-20");
  });

  it("leaves the invoice date unchanged when none is provided", async () => {
    const admin = await createTestUser("ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice({ ...baseInvoiceInput, date: "2026-03-15" });
    if (!created.success) throw new Error("setup failed");

    const result = await updateInvoice(created.id, baseInvoiceInput);

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.date.toISOString().slice(0, 10)).toBe("2026-03-15");
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

describe("revertInvoiceToUnpaid", () => {
  async function createPaidInvoice() {
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");
    await updateInvoiceStatus(created.id, "PAID");
    return created.id;
  }

  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await revertInvoiceToUnpaid("does-not-matter", "whatever");

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  it("lets a staff member authorize the action with a valid admin's password", async () => {
    await createTestUserWithPassword("admin-password", "ADMIN");
    const staff = await createTestUserWithPassword("staff-password", "USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });
    const invoiceId = await createPaidInvoice();

    const result = await revertInvoiceToUnpaid(invoiceId, "admin-password");

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe("UNPAID");
  });

  it("rejects a staff member's own password — it isn't an admin's", async () => {
    const staff = await createTestUserWithPassword("staff-password", "USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });
    const invoiceId = await createPaidInvoice();

    const result = await revertInvoiceToUnpaid(invoiceId, "staff-password");

    expect(result).toEqual({ success: false, error: "Incorrect password." });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe("PAID");
  });

  it("ignores a deactivated admin's password", async () => {
    const deactivatedAdmin = await createTestUserWithPassword("old-admin-password", "ADMIN");
    await prisma.user.update({ where: { id: deactivatedAdmin.id }, data: { isActive: false } });
    mockedGetCurrentUser.mockResolvedValue({
      id: deactivatedAdmin.id,
      username: deactivatedAdmin.username,
      name: deactivatedAdmin.name,
      role: deactivatedAdmin.role,
    });
    const invoiceId = await createPaidInvoice();

    const result = await revertInvoiceToUnpaid(invoiceId, "old-admin-password");

    expect(result).toEqual({ success: false, error: "Incorrect password." });
  });

  it("rejects an incorrect admin password and leaves the invoice PAID", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const invoiceId = await createPaidInvoice();

    const result = await revertInvoiceToUnpaid(invoiceId, "wrong-password");

    expect(result).toEqual({ success: false, error: "Incorrect password." });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe("PAID");
  });

  it("rejects reverting an invoice that isn't currently PAID", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const result = await revertInvoiceToUnpaid(created.id, "correct-password");

    expect(result).toEqual({
      success: false,
      error: "Only a paid invoice can be marked as unpaid.",
    });
  });

  it("reverts a PAID invoice to UNPAID when a valid admin password is provided", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const invoiceId = await createPaidInvoice();

    const result = await revertInvoiceToUnpaid(invoiceId, "correct-password");

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(invoice?.status).toBe("UNPAID");
  });
});

describe("cancelInvoice", () => {
  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await cancelInvoice("does-not-matter", "whatever");

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  it("lets a staff member authorize the action with a valid admin's password", async () => {
    await createTestUserWithPassword("admin-password", "ADMIN");
    const staff = await createTestUserWithPassword("staff-password", "USER");
    mockedGetCurrentUser.mockResolvedValue({
      id: staff.id,
      username: staff.username,
      name: staff.name,
      role: staff.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const result = await cancelInvoice(created.id, "admin-password");

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("CANCELLED");
  });

  it("rejects an incorrect admin password and leaves the invoice UNPAID", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const result = await cancelInvoice(created.id, "wrong-password");

    expect(result).toEqual({ success: false, error: "Incorrect password." });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("UNPAID");
  });

  it("cancels an UNPAID invoice when a valid admin password is provided", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");

    const result = await cancelInvoice(created.id, "correct-password");

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("CANCELLED");
  });

  it("cancels a PAID invoice directly, without needing to revert to unpaid first", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");
    await updateInvoiceStatus(created.id, "PAID");

    const result = await cancelInvoice(created.id, "correct-password");

    expect(result).toEqual({ success: true });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("CANCELLED");
  });

  it("refuses to cancel an already-cancelled invoice", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");
    await cancelInvoice(created.id, "correct-password");

    const result = await cancelInvoice(created.id, "correct-password");

    expect(result).toEqual({ success: false, error: "This invoice is already cancelled." });
  });

  it("cancelled invoices can never be changed again via updateInvoiceStatus", async () => {
    const admin = await createTestUserWithPassword("correct-password", "ADMIN");
    mockedGetCurrentUser.mockResolvedValue({
      id: admin.id,
      username: admin.username,
      name: admin.name,
      role: admin.role,
    });
    const created = await createInvoice(baseInvoiceInput);
    if (!created.success) throw new Error("setup failed");
    await cancelInvoice(created.id, "correct-password");

    const result = await updateInvoiceStatus(created.id, "PAID");

    expect(result).toEqual({ success: false, error: "A cancelled invoice cannot be changed." });
    const invoice = await prisma.invoice.findUnique({ where: { id: created.id } });
    expect(invoice?.status).toBe("CANCELLED");
  });
});
