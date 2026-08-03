import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/invoice-math";

const PAGE_SIZE = 20;

export const PRODUCT_SORT_OPTIONS = {
  name_asc: { name: "asc" },
  name_desc: { name: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
} as const satisfies Record<string, Prisma.ProductOrderByWithRelationInput>;

export type ProductSort = keyof typeof PRODUCT_SORT_OPTIONS;
export const DEFAULT_PRODUCT_SORT: ProductSort = "name_asc";

function resolveProductSort(sort?: string): ProductSort {
  return sort && sort in PRODUCT_SORT_OPTIONS ? (sort as ProductSort) : DEFAULT_PRODUCT_SORT;
}

export async function getAllProducts(page = 1, query?: string, sort?: string) {
  const currentPage = Math.max(1, page);
  const trimmedQuery = query?.trim();
  const resolvedSort = resolveProductSort(sort);

  const where: Prisma.ProductWhereInput | undefined = trimmedQuery
    ? {
        OR: [
          { name: { contains: trimmedQuery, mode: "insensitive" } },
          { reference: { contains: trimmedQuery, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: PRODUCT_SORT_OPTIONS[resolvedSort],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        name: true,
        price: true,
        createdAt: true,
        _count: { select: { items: true } },
        items: { select: { lineTotal: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const rows = products.map((p) => ({
    id: p.id,
    reference: p.reference,
    name: p.name,
    price: p.price,
    createdAt: p.createdAt,
    timesUsed: p._count.items,
    totalRevenue: round2(p.items.reduce((sum, i) => sum + i.lineTotal, 0)),
  }));

  return {
    products: rows,
    totalCount,
    pageCount: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    currentPage,
    sort: resolvedSort,
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      name: true,
      price: true,
      createdAt: true,
      items: { select: { lineTotal: true } },
    },
  });

  if (!product) return null;

  const totalRevenue = round2(product.items.reduce((sum, i) => sum + i.lineTotal, 0));

  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    price: product.price,
    createdAt: product.createdAt,
    timesUsed: product.items.length,
    totalRevenue,
  };
}

export async function findProductByExactName(name: string) {
  return prisma.product.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
}

/** Lightweight full product list for client-side autocomplete — not paginated. */
export function getProductDirectory() {
  return prisma.product.findMany({
    orderBy: { name: "asc" },
    select: { id: true, reference: true, name: true, price: true },
  });
}
