import Link from "next/link";
import { Plus, X } from "lucide-react";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import { getAllInvoices } from "@/lib/invoices";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const requestedPage = Number(page) || 1;
  const { invoices, pageCount, currentPage } = await getAllInvoices(requestedPage, q);

  const pageHref = (targetPage: number) =>
    `/invoices?page=${targetPage}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {q ? `Search results for "${q}"` : "Invoices"}
          </h1>
          {q && (
            <Link
              href="/invoices"
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X size={12} />
              Clear search
            </Link>
          )}
        </div>
        <Link
          href="/invoices/new"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Invoice
        </Link>
      </div>

      <RecentInvoicesTable
        title={q ? "Matching Invoices" : "All Invoices"}
        invoices={invoices}
        emptyMessage={
          q ? "No invoices match your search." : "No invoices yet. Create your first invoice to see it here."
        }
      />

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Link
              href={pageHref(currentPage - 1)}
              aria-disabled={currentPage <= 1}
              className={`rounded-md border border-border px-3 py-1.5 font-medium ${
                currentPage <= 1
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted"
              }`}
            >
              Previous
            </Link>
            <Link
              href={pageHref(currentPage + 1)}
              aria-disabled={currentPage >= pageCount}
              className={`rounded-md border border-border px-3 py-1.5 font-medium ${
                currentPage >= pageCount
                  ? "pointer-events-none opacity-40"
                  : "hover:bg-surface-muted"
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
