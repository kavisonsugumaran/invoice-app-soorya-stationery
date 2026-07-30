import { prisma } from "@/lib/prisma";

export type DashboardStats = {
  totalInvoiced: number;
  totalCount: number;
  paidTotal: number;
  paidCount: number;
  unpaidTotal: number;
  unpaidCount: number;
  invoiceCountThisMonth: number;
  invoiceCountLastMonth: number;
};

export type MonthlyRevenuePoint = {
  month: string;
  total: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [totals, paid, unpaid, invoiceCountThisMonth, invoiceCountLastMonth] =
    await Promise.all([
      prisma.invoice.aggregate({ _sum: { total: true }, _count: true }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: "PAID" },
      }),
      prisma.invoice.aggregate({
        _sum: { total: true },
        _count: true,
        where: { status: "UNPAID" },
      }),
      prisma.invoice.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.invoice.count({
        where: { createdAt: { gte: lastMonthStart, lt: monthStart } },
      }),
    ]);

  return {
    totalInvoiced: totals._sum.total ?? 0,
    totalCount: totals._count,
    paidTotal: paid._sum.total ?? 0,
    paidCount: paid._count,
    unpaidTotal: unpaid._sum.total ?? 0,
    unpaidCount: unpaid._count,
    invoiceCountThisMonth,
    invoiceCountLastMonth,
  };
}

export async function getMonthlyRevenueTrend(
  months = 6
): Promise<MonthlyRevenuePoint[]> {
  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: rangeStart } },
    select: { createdAt: true, total: true },
  });

  const buckets: MonthlyRevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: bucketDate.toLocaleDateString("en-US", { month: "short" }),
      total: 0,
    });
  }

  for (const invoice of invoices) {
    const diff =
      (now.getFullYear() - invoice.createdAt.getFullYear()) * 12 +
      (now.getMonth() - invoice.createdAt.getMonth());
    const index = months - 1 - diff;
    if (index >= 0 && index < buckets.length) {
      buckets[index].total += invoice.total;
    }
  }

  return buckets;
}
