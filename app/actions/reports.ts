"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-guard";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { dateRangeFilter, type InvoiceTaxFolder } from "@/lib/invoices";
import { buildInvoiceExportRows, buildInvoiceWorkbook } from "@/lib/invoice-export";

export type ExportInvoicesResult =
  | { success: true; fileName: string; base64: string; rowCount: number }
  | { success: false; error: string };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Invoice register for accounts/VAT filing, following the Invoices page's
 * own filters: date range, the VAT/Non-VAT tab, and the status dropdown.
 * Unlike that page's list (commercial invoices only), small bills are
 * included under "All" and "Non-VAT" — they're non-VAT supplies and belong
 * in the accounts. Cancelled invoices are left out unless the status filter
 * is explicitly set to Cancelled. Returned as base64 because Server Actions
 * can't stream a file — the client turns it back into a Blob and downloads it.
 */
export async function exportInvoicesToExcel(input: {
  from?: string;
  to?: string;
  folder?: InvoiceTaxFolder;
  status?: InvoiceStatus;
}): Promise<ExportInvoicesResult> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };

  const from = input.from || undefined;
  const to = input.to || undefined;
  if ((from && !DATE_ONLY.test(from)) || (to && !DATE_ONLY.test(to))) {
    return { success: false, error: "Invalid date range." };
  }
  if (from && to && from > to) {
    return { success: false, error: "The From date must be on or before the To date." };
  }

  const folder: InvoiceTaxFolder = input.folder ?? "all";
  if (!["all", "vat", "no-vat"].includes(folder)) {
    return { success: false, error: "Invalid filter." };
  }
  if (input.status && !["PAID", "UNPAID", "CANCELLED"].includes(input.status)) {
    return { success: false, error: "Invalid filter." };
  }

  const dateFilter = dateRangeFilter(from, to);
  const where: Prisma.InvoiceWhereInput = {
    status: input.status ?? { not: "CANCELLED" },
    ...(folder === "vat" ? { billType: "COMMERCIAL", taxEnabled: true } : {}),
    ...(folder === "no-vat" ? { taxEnabled: false } : {}),
    ...(dateFilter ? { date: dateFilter } : {}),
  };
  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      invoiceNo: true,
      date: true,
      billType: true,
      taxEnabled: true,
      taxPercent: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      status: true,
      customer: { select: { name: true, taxId: true } },
    },
  });

  const rows = buildInvoiceExportRows(invoices);
  const periodLabel =
    from && to ? `${from} to ${to}` : from ? `from ${from}` : to ? `up to ${to}` : "all dates";
  const filterLabel = [
    folder === "vat"
      ? "VAT invoices only"
      : folder === "no-vat"
        ? "non-VAT invoices and small bills"
        : "all invoices and small bills",
    input.status ? `${input.status.toLowerCase()} only` : "cancelled excluded",
  ].join(", ");
  const buffer = await buildInvoiceWorkbook(rows, `${periodLabel} (${filterLabel})`);
  const fileSuffix = [
    from || to ? `${from ?? "start"}_to_${to ?? "today"}` : "all-dates",
    folder === "vat" ? "VAT" : folder === "no-vat" ? "NonVAT" : null,
    input.status ?? null,
  ]
    .filter(Boolean)
    .join("_");

  return {
    success: true,
    fileName: `KadeBill_Invoices_${fileSuffix}.xlsx`,
    base64: buffer.toString("base64"),
    rowCount: rows.length,
  };
}
