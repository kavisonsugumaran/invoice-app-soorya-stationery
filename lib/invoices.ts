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

  const [invoices, totalCount] = await Promise.all([
    prisma.invoice.findMany({
      where,
      // Most recent invoice date first (so August invoices group above July,
      // above June, ...), then invoiceNo descending as a same-date tiebreak
      // so a higher serial within that date shows above a lower one.
      // Deliberately not createdAt: the Aug 2026 backfill feature lets
      // invoices representing older, previously-handwritten paper invoices
      // get entered into the system today with an old date/serial — sorting
      // by createdAt would put those at the top just because they were
      // typed in most recently, not because they're actually the newest
      // invoices.
      orderBy: [{ date: "desc" }, { invoiceNo: "desc" }],
      select: invoiceListSelect,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    currentPage,
  };
}
