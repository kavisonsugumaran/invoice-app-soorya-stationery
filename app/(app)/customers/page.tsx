import Link from "next/link";
import { Plus, Search } from "lucide-react";
import CustomersTable from "@/components/customers/CustomersTable";
import { getAllCustomers } from "@/lib/customers";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const requestedPage = Number(page) || 1;
  const { customers, pageCount, currentPage, totalCount } = await getAllCustomers(
    requestedPage,
    q
  );

  const pageHref = (targetPage: number) =>
    `/customers?page=${targetPage}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <Link
          href="/customers/new"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Customer
        </Link>
      </div>

      <form action="/customers" method="GET" className="max-w-sm">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name, phone, or email..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        {totalCount} customer{totalCount === 1 ? "" : "s"}
        {q ? ` matching "${q}"` : ""}
      </p>

      <CustomersTable
        customers={customers}
        emptyMessage={
          q ? "No customers match your search." : "No customers yet. Add your first customer to get started."
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
