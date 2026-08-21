import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const invoiceListSelect = {
  id: true,
  invoiceNo: true,
  date: true,
  status: true,
  total: true,
  customer: { select: { name: true } },
} as const;

const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

/**
 * Sortable numeric key derived from an invoiceNo itself (year/month/serial,
 * and day where the format encodes one), not the invoice's `date` field or
 * `createdAt` — this list needs to read as August invoices, then July, then
 * June, ... with higher serials on top within a month, which is what the
 * invoice number represents. `date` isn't reliable for this: the Aug 2026
 * backfill feature lets a July-numbered invoice get entered today with
 * today's date still sitting in the Date of Invoice field, and `createdAt`
 * would rank a backfilled invoice by when it was typed in, not what it
 * represents. Sorting the invoiceNo string directly doesn't work either —
 * month abbreviations don't sort alphabetically in calendar order (e.g.
 * "SEP" < "AUG" alphabetically, backwards from calendar order), so the
 * month has to be converted to a number first.
 *
 * Handles both the current Gazette 2481/22 format (YYMMM_QQQQ_XXXXX, e.g.
 * 26AUG_SST_00150) and the pre-switch ad-hoc format (INV-YYYYMMDD-NN) —
 * see the invoiceNo generation comments in app/actions/invoices.ts. Returns
 * -1 (sorts last) for anything that matches neither, e.g. test invoice
 * numbers, rather than crashing or accidentally sorting them first.
 */
function invoiceNoSortKey(invoiceNo: string): number {
  const gazetteMatch = invoiceNo.match(/^(\d{2})([A-Z]{3})_[A-Z0-9]+_(\d+)$/);
  if (gazetteMatch) {
    const [, yy, mmm, serial] = gazetteMatch;
    const month = MONTH_ABBREVIATIONS.indexOf(mmm) + 1;
    if (month > 0) {
      return Number(yy) * 1e10 + month * 1e8 + Number(serial);
    }
  }

  const oldMatch = invoiceNo.match(/^INV-(\d{4})(\d{2})(\d{2})-(\d+)$/);
  if (oldMatch) {
    const [, yyyy, mm, dd, serial] = oldMatch;
    const yy = Number(yyyy) % 100;
    return yy * 1e10 + Number(mm) * 1e8 + Number(dd) * 1e6 + Number(serial);
  }

  return -1;
}

export function getRecentInvoices(limit = 8) {
  return prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: invoiceListSelect,
  });
}

export function getInvoicesByCustomer(customerId: string) {
  return prisma.invoice.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: invoiceListSelect,
  });
}

export function getInvoicesByProduct(productId: string) {
  return prisma.invoice.findMany({
    where: { items: { some: { productId } } },
    orderBy: { createdAt: "desc" },
    select: invoiceListSelect,
  });
}

export function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { id: "asc" } },
      createdBy: { select: { name: true } },
    },
  });
}

const PAGE_SIZE = 20;

export async function getAllInvoices(page = 1, query?: string) {
  const currentPage = Math.max(1, page);
  const trimmedQuery = query?.trim();

  const where: Prisma.InvoiceWhereInput | undefined = trimmedQuery
    ? {
        OR: [
          { invoiceNo: { contains: trimmedQuery, mode: "insensitive" } },
          { customer: { name: { contains: trimmedQuery, mode: "insensitive" } } },
        ],
      }
    : undefined;

  // Sorting by invoiceNo's own encoded year/month/serial (see
  // invoiceNoSortKey) can't be expressed as a Prisma/SQL orderBy, so this
  // fetches every matching row and sorts+paginates in JS instead of at the
  // DB level. Fine at this business's scale (hundreds to low thousands of
  // invoices) given invoiceListSelect keeps each row small.
  const [allMatching, totalCount] = await Promise.all([
    prisma.invoice.findMany({ where, select: invoiceListSelect }),
    prisma.invoice.count({ where }),
  ]);

  allMatching.sort((a, b) => invoiceNoSortKey(b.invoiceNo) - invoiceNoSortKey(a.invoiceNo));
  const invoices = allMatching.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return {
    invoices,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    currentPage,
  };
}
