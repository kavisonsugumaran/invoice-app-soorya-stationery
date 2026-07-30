import Link from "next/link";
import { Plus, Search } from "lucide-react";
import ProductsTable from "@/components/products/ProductsTable";
import { getAllProducts } from "@/lib/products";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page, q } = await searchParams;
  const requestedPage = Number(page) || 1;
  const { products, pageCount, currentPage, totalCount } = await getAllProducts(
    requestedPage,
    q
  );

  const pageHref = (targetPage: number) =>
    `/products?page=${targetPage}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Products</h1>
        <Link
          href="/products/new"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={16} />
          New Product
        </Link>
      </div>

      <form action="/products" method="GET" className="max-w-sm">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or reference..."
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        {totalCount} product{totalCount === 1 ? "" : "s"}
        {q ? ` matching "${q}"` : ""}
      </p>

      <ProductsTable
        products={products}
        emptyMessage={
          q ? "No products match your search." : "No products yet. Add your first product to get started."
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
