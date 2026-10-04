import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { resetDb } from "@/tests/reset-db";
import { getCurrentUser } from "@/lib/dal";
import { exportInvoicesToExcel } from "./reports";

vi.mock("@/lib/dal", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedGetCurrentUser = vi.mocked(getCurrentUser);

async function loginAsStaff() {
  const user = await prisma.user.create({
    data: {
      username: `staff-${Date.now()}-${Math.random()}`,
      name: "Staff",
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

async function seedInvoice(data: {
  invoiceNo: string;
  date: string;
  billType?: "COMMERCIAL" | "SMALL";
  taxEnabled?: boolean;
  status?: "PAID" | "UNPAID" | "CANCELLED";
  subtotal: number;
  taxAmount?: number;
  customer?: { name: string; taxId?: string };
}) {
  const customer = data.customer
    ? await prisma.customer.create({
        data: { name: data.customer.name, taxId: data.customer.taxId ?? null },
      })
    : null;
  const taxAmount = data.taxAmount ?? 0;
  return prisma.invoice.create({
    data: {
      invoiceNo: data.invoiceNo,
      date: new Date(data.date),
      billType: data.billType ?? "COMMERCIAL",
      taxEnabled: data.taxEnabled ?? false,
      taxPercent: data.taxEnabled ? 18 : 0,
      status: data.status ?? "UNPAID",
      subtotal: data.subtotal,
      taxAmount,
      total: data.subtotal + taxAmount,
      customerId: customer?.id ?? null,
    },
  });
}

async function readSheet(base64: string) {
  const workbook = new ExcelJS.Workbook();
  // exceljs ships its own (older) Buffer typing; the runtime value is fine.
  await workbook.xlsx.load(
    Buffer.from(base64, "base64") as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Invoices")!;
  const rows: unknown[][] = [];
  sheet.eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
  return rows;
}

beforeEach(async () => {
  await resetDb();
  vi.clearAllMocks();
});

describe("exportInvoicesToExcel", () => {
  it("rejects when there is no authenticated user", async () => {
    mockedGetCurrentUser.mockResolvedValue(null);

    const result = await exportInvoicesToExcel({});

    expect(result).toEqual({ success: false, error: "Please sign in." });
  });

  it("includes VAT, non-VAT and small bills, excludes cancelled, oldest first, with totals", async () => {
    await loginAsStaff();
    await seedInvoice({
      invoiceNo: "26SEP_SST_0002",
      date: "2026-09-10",
      taxEnabled: true,
      subtotal: 1000,
      taxAmount: 180,
      customer: { name: "Acme Ltd", taxId: "012345678" },
    });
    await seedInvoice({ invoiceNo: "26SEP_SST_0001", date: "2026-09-05", subtotal: 500 });
    await seedInvoice({ invoiceNo: "E001", date: "2026-09-07", billType: "SMALL", subtotal: 250 });
    await seedInvoice({
      invoiceNo: "26SEP_SST_0003",
      date: "2026-09-12",
      subtotal: 9999,
      status: "CANCELLED",
    });

    const result = await exportInvoicesToExcel({});
    if (!result.success) throw new Error(result.error);
    expect(result.rowCount).toBe(3);

    const rows = await readSheet(result.base64);
    // Title, header, 3 data rows, totals.
    expect(rows).toHaveLength(6);
    expect(rows[1][0]).toBe("Date");
    expect(rows.slice(2, 5).map((r) => [r[1], r[2]])).toEqual([
      ["26SEP_SST_0001", "Non-VAT Invoice"],
      ["E001", "Small Bill"],
      ["26SEP_SST_0002", "VAT Invoice"],
    ]);
    // TIN kept as text with its leading zero.
    expect(rows[4][4]).toBe("012345678");
    const totals = rows[5] as Array<{ result?: number } | string | undefined>;
    expect(totals[3]).toBe("TOTAL");
    expect((totals[5] as { result: number }).result).toBe(1750);
    expect((totals[7] as { result: number }).result).toBe(180);
    expect((totals[8] as { result: number }).result).toBe(1930);
  });

  it("only includes invoices within the date range (inclusive)", async () => {
    await loginAsStaff();
    await seedInvoice({ invoiceNo: "26AUG_SST_0001", date: "2026-08-31", subtotal: 100 });
    await seedInvoice({ invoiceNo: "26SEP_SST_0001", date: "2026-09-01", subtotal: 200 });
    await seedInvoice({ invoiceNo: "26SEP_SST_0002", date: "2026-09-30", subtotal: 300 });
    await seedInvoice({ invoiceNo: "26OCT_SST_0001", date: "2026-10-01", subtotal: 400 });

    const result = await exportInvoicesToExcel({ from: "2026-09-01", to: "2026-09-30" });
    if (!result.success) throw new Error(result.error);

    expect(result.rowCount).toBe(2);
    expect(result.fileName).toBe("KadeBill_Invoices_2026-09-01_to_2026-09-30.xlsx");
  });

  describe("tab and status filters", () => {
    async function seedMix() {
      await seedInvoice({ invoiceNo: "26SEP_SST_0001", date: "2026-09-01", taxEnabled: true, subtotal: 1000, taxAmount: 180 });
      await seedInvoice({ invoiceNo: "26SEP_SST_0002", date: "2026-09-02", subtotal: 500, status: "PAID" });
      await seedInvoice({ invoiceNo: "E001", date: "2026-09-03", billType: "SMALL", subtotal: 250 });
      await seedInvoice({ invoiceNo: "26SEP_SST_0003", date: "2026-09-04", subtotal: 900, status: "CANCELLED" });
    }

    async function exportedNos(input: Parameters<typeof exportInvoicesToExcel>[0]) {
      const result = await exportInvoicesToExcel(input);
      if (!result.success) throw new Error(result.error);
      const rows = await readSheet(result.base64);
      return { nos: rows.slice(2, 2 + result.rowCount).map((r) => r[1]), fileName: result.fileName };
    }

    it("VAT tab exports only VAT invoices — no small bills", async () => {
      await loginAsStaff();
      await seedMix();

      const { nos, fileName } = await exportedNos({ folder: "vat" });

      expect(nos).toEqual(["26SEP_SST_0001"]);
      expect(fileName).toBe("KadeBill_Invoices_all-dates_VAT.xlsx");
    });

    it("Non VAT tab exports non-VAT invoices and small bills", async () => {
      await loginAsStaff();
      await seedMix();

      const { nos } = await exportedNos({ folder: "no-vat" });

      expect(nos).toEqual(["26SEP_SST_0002", "E001"]);
    });

    it("status filter narrows the export", async () => {
      await loginAsStaff();
      await seedMix();

      const { nos } = await exportedNos({ status: "PAID" });

      expect(nos).toEqual(["26SEP_SST_0002"]);
    });

    it("includes cancelled invoices only when the status filter asks for them", async () => {
      await loginAsStaff();
      await seedMix();

      expect((await exportedNos({})).nos).not.toContain("26SEP_SST_0003");
      expect((await exportedNos({ status: "CANCELLED" })).nos).toEqual(["26SEP_SST_0003"]);
    });
  });

  it("rejects a From date after the To date", async () => {
    await loginAsStaff();

    const result = await exportInvoicesToExcel({ from: "2026-09-30", to: "2026-09-01" });

    expect(result.success).toBe(false);
  });

  it("produces a valid workbook with just headers when nothing matches", async () => {
    await loginAsStaff();

    const result = await exportInvoicesToExcel({ from: "2026-01-01", to: "2026-01-31" });
    if (!result.success) throw new Error(result.error);

    expect(result.rowCount).toBe(0);
    const rows = await readSheet(result.base64);
    expect(rows).toHaveLength(2);
  });
});
