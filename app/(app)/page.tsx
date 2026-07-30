import StatCard from "@/components/dashboard/StatCard";
import RevenueTrendChart from "@/components/dashboard/RevenueTrendChart";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import { getDashboardStats, getMonthlyRevenueTrend } from "@/lib/dashboard";
import { getRecentInvoices } from "@/lib/invoices";

export default async function DashboardPage() {
  const [stats, trend, recentInvoices] = await Promise.all([
    getDashboardStats(),
    getMonthlyRevenueTrend(),
    getRecentInvoices(8),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Invoiced"
          value={stats.totalInvoiced.toFixed(2)}
          hint={`${stats.totalCount} invoice${stats.totalCount === 1 ? "" : "s"} total`}
        />
        <StatCard
          label="Paid"
          value={stats.paidTotal.toFixed(2)}
          tone="success"
          hint={`${stats.paidCount} invoice${stats.paidCount === 1 ? "" : "s"} paid`}
        />
        <StatCard
          label="Unpaid"
          value={stats.unpaidTotal.toFixed(2)}
          tone="warning"
          hint={`${stats.unpaidCount} awaiting payment`}
        />
        <StatCard
          label="Invoices This Month"
          value={String(stats.invoiceCountThisMonth)}
          trendPercent={
            stats.invoiceCountLastMonth > 0
              ? Math.round(
                  ((stats.invoiceCountThisMonth - stats.invoiceCountLastMonth) /
                    stats.invoiceCountLastMonth) *
                    100
                )
              : undefined
          }
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Revenue — last 6 months
        </h2>
        <RevenueTrendChart data={trend} />
      </div>

      <RecentInvoicesTable invoices={recentInvoices} viewAllHref="/invoices" />
    </div>
  );
}
