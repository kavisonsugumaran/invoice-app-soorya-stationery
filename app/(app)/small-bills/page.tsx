import Link from "next/link";
import { Plus, X } from "lucide-react";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import Pagination from "@/components/ui/Pagination";
import StatusDateFilterBar from "@/components/ui/StatusDateFilterBar";
import { getAllSmallBills } from "@/lib/invoices";
import type { InvoiceStatus } from "@prisma/client";

const STATUS_VALUES: InvoiceStatus[] = ["UNPAID", "PAID", "CANCELLED"];

export default async function SmallBillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; from?: string; to?: string }>;
}) {
  const { page, q, status, from, to } = await searchParams;
  const requestedPage = Number(page) || 1;
  const statusFilter = STATUS_VALUES.find((s) => s === status);
  const { invoices, pageCount, currentPage } = await getAllSmallBills(
    requestedPage,
    q,
    statusFilter,
    from,
    to
  );

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("page", String(targetPage));
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `/small-bills?${qs}` : "/small-bills";
  };

  const hasExtraFilters = Boolean(status || from || to);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {q ? `Search results for "${q}"` : "Small Bills"}
          </h1>
          {q && (
            <Link
              href="/small-bills"
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X size={12} />
              Clear search
            </Link>
          )}
        </div>
        <Link
          href="/small-bills/new"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Small Bill
        </Link>
      </div>

      <StatusDateFilterBar />

      <RecentInvoicesTable
        title={q ? "Matching Small Bills" : "All Small Bills"}
        invoices={invoices}
        hrefBase="/small-bills"
        emptyMessage={
          q
            ? "No small bills match your search."
            : hasExtraFilters
              ? "No small bills match the selected filters."
              : "No small bills yet. Create your first one to see it here."
        }
      />

      <Pagination currentPage={currentPage} pageCount={pageCount} hrefForPage={pageHref} />
    </div>
  );
}
