import ExcelJS from "exceljs";
import type { BillType } from "@prisma/client";
import { round2 } from "@/lib/invoice-math";

export type ExportableInvoice = {
  invoiceNo: string;
  date: Date;
  billType: BillType;
  taxEnabled: boolean;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: string;
  customer: { name: string; taxId: string | null } | null;
};

export type InvoiceExportRow = {
  date: string; // YYYY-MM-DD, Asia/Colombo calendar day
  invoiceNo: string;
  type: "VAT Invoice" | "Non-VAT Invoice" | "Small Bill";
  customer: string;
  customerTin: string;
  valueOfSupply: number;
  vatPercent: number;
  vatAmount: number;
  total: number;
  status: string;
};

const COLOMBO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Colombo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function typeLabel(invoice: ExportableInvoice): InvoiceExportRow["type"] {
  if (invoice.billType === "SMALL") return "Small Bill";
  return invoice.taxEnabled ? "VAT Invoice" : "Non-VAT Invoice";
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Oldest first — the order an accountant reads a period's register in. */
export function buildInvoiceExportRows(invoices: ExportableInvoice[]): InvoiceExportRow[] {
  return invoices
    .map((invoice) => ({
      date: COLOMBO_DAY.format(invoice.date),
      invoiceNo: invoice.invoiceNo,
      type: typeLabel(invoice),
      customer: invoice.customer?.name ?? "",
      customerTin: invoice.customer?.taxId ?? "",
      valueOfSupply: invoice.subtotal,
      vatPercent: invoice.taxEnabled ? invoice.taxPercent : 0,
      vatAmount: invoice.taxAmount,
      total: invoice.total,
      status: statusLabel(invoice.status),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.invoiceNo.localeCompare(b.invoiceNo));
}

const MONEY_FORMAT = "#,##0.00";

export async function buildInvoiceWorkbook(
  rows: InvoiceExportRow[],
  periodLabel: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Invoices");

  const columns = [
    { header: "Date", width: 12 },
    { header: "Invoice No.", width: 20 },
    { header: "Type", width: 16 },
    { header: "Customer", width: 34 },
    { header: "Customer TIN", width: 16 },
    { header: "Value of Supply", width: 16 },
    { header: "VAT %", width: 8 },
    { header: "VAT Amount", width: 14 },
    { header: "Total", width: 16 },
    { header: "Status", width: 10 },
  ];
  columns.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
  });

  // Row 1: title, row 2: header, rows 3..: data, then a totals row.
  sheet.addRow([`Invoice register — ${periodLabel}`]).font = {
    bold: true,
    size: 12,
  };
  sheet.addRow(columns.map((c) => c.header)).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  for (const row of rows) {
    const [y, m, d] = row.date.split("-").map(Number);
    const excelRow = sheet.addRow([
      new Date(Date.UTC(y, m - 1, d)),
      row.invoiceNo,
      row.type,
      row.customer,
      row.customerTin,
      row.valueOfSupply,
      row.vatPercent,
      row.vatAmount,
      row.total,
      row.status,
    ]);
    excelRow.getCell(1).numFmt = "mm/dd/yyyy";
    // Text, not number — keeps any leading zeros on a TIN intact.
    excelRow.getCell(5).numFmt = "@";
    for (const col of [6, 8, 9]) excelRow.getCell(col).numFmt = MONEY_FORMAT;
  }

  if (rows.length > 0) {
    const firstDataRow = 3;
    const lastDataRow = rows.length + 2;
    const totalsRow = sheet.addRow([]);
    totalsRow.getCell(4).value = "TOTAL";
    const sums: Record<number, number> = {
      6: round2(rows.reduce((s, r) => s + r.valueOfSupply, 0)),
      8: round2(rows.reduce((s, r) => s + r.vatAmount, 0)),
      9: round2(rows.reduce((s, r) => s + r.total, 0)),
    };
    for (const col of [6, 8, 9]) {
      const letter = sheet.getColumn(col).letter;
      const cell = totalsRow.getCell(col);
      // Cached result too, so viewers that don't recalculate still show it.
      cell.value = {
        formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`,
        result: sums[col],
      };
      cell.numFmt = MONEY_FORMAT;
    }
    totalsRow.font = { bold: true };
    for (let col = 1; col <= columns.length; col++) {
      totalsRow.getCell(col).border = { top: { style: "thin" } };
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
