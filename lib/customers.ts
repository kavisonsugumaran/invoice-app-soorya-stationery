import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/invoice-math";

const PAGE_SIZE = 20;

export const CUSTOMER_SORT_OPTIONS = {
  name_asc: { name: "asc" },
  name_desc: { name: "desc" },
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
} as const satisfies Record<string, Prisma.CustomerOrderByWithRelationInput>;

export type CustomerSort = keyof typeof CUSTOMER_SORT_OPTIONS;
export const DEFAULT_CUSTOMER_SORT: CustomerSort = "name_asc";

function resolveCustomerSort(sort?: string): CustomerSort {
  return sort && sort in CUSTOMER_SORT_OPTIONS ? (sort as CustomerSort) : DEFAULT_CUSTOMER_SORT;
}

export async function getAllCustomers(page = 1, query?: string, sort?: string) {
  const currentPage = Math.max(1, page);
  const trimmedQuery = query?.trim();
  const resolvedSort = resolveCustomerSort(sort);

  const where: Prisma.CustomerWhereInput | undefined = trimmedQuery
    ? {
        OR: [
          { name: { contains: trimmedQuery, mode: "insensitive" } },
          { phone: { contains: trimmedQuery, mode: "insensitive" } },
          { email: { contains: trimmedQuery, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [customers, totalCount] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: CUSTOMER_SORT_OPTIONS[resolvedSort],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        createdAt: true,
        // Cancelled invoices are void — excluded from both the count and the total.
        _count: { select: { invoices: { where: { status: { not: "CANCELLED" } } } } },
        invoices: { where: { status: { not: "CANCELLED" } }, select: { total: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    createdAt: c.createdAt,
    invoiceCount: c._count.invoices,
    totalInvoiced: round2(c.invoices.reduce((sum, i) => sum + i.total, 0)),
  }));

  return {
    customers: rows,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    currentPage,
    sort: resolvedSort,
  };
}

export async function getCustomerById(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      address: true,
      taxId: true,
      createdAt: true,
      // Cancelled invoices are void — excluded from this customer's totals entirely.
      invoices: { where: { status: { not: "CANCELLED" } }, select: { total: true, status: true } },
    },
  });

  if (!customer) return null;

  const totalInvoiced = round2(customer.invoices.reduce((sum, i) => sum + i.total, 0));
  const totalPaid = round2(
    customer.invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + i.total, 0)
  );
  const totalUnpaid = round2(totalInvoiced - totalPaid);

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    taxId: customer.taxId,
    createdAt: customer.createdAt,
    invoiceCount: customer.invoices.length,
    totalInvoiced,
    totalPaid,
    totalUnpaid,
  };
}

export async function findCustomerByPhone(phone: string, excludeId?: string) {
  return prisma.customer.findFirst({
    where: { phone, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
}

/** Lightweight full customer list for client-side autocomplete — not paginated. */
export function getCustomerDirectory() {
  return prisma.customer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true, address: true, taxId: true },
  });
}
