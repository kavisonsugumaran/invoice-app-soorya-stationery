import Link from "next/link";
import { Plus } from "lucide-react";
import CustomersTable from "@/components/customers/CustomersTable";
import ListFilterBar from "@/components/ui/ListFilterBar";
import Pagination from "@/components/ui/Pagination";
import { getAllCustomers, DEFAULT_CUSTOMER_SORT } from "@/lib/customers";

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const { page, q, sort } = await searchParams;
  const requestedPage = Number(page) || 1;
  const { customers, pageCount, currentPage, totalCount, sort: resolvedSort } =
    await getAllCustomers(requestedPage, q, sort);

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    if (q) params.set("q", q);
    if (resolvedSort !== DEFAULT_CUSTOMER_SORT) params.set("sort", resolvedSort);
    return `/customers?${params}`;
  };

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

      <ListFilterBar
        basePath="/customers"
        initialQuery={q ?? ""}
        initialSort={resolvedSort}
        defaultSort={DEFAULT_CUSTOMER_SORT}
        sortOptions={SORT_OPTIONS}
        searchPlaceholder="Search by name, phone, or email..."
      />

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

      <Pagination currentPage={currentPage} pageCount={pageCount} hrefForPage={pageHref} />
    </div>
  );
}
