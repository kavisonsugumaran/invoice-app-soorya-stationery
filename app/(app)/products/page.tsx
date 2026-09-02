import Link from "next/link";
import { Plus } from "lucide-react";
import ProductsTable from "@/components/products/ProductsTable";
import ListFilterBar from "@/components/ui/ListFilterBar";
import Pagination from "@/components/ui/Pagination";
import { getAllProducts, DEFAULT_PRODUCT_SORT } from "@/lib/products";

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "price_asc", label: "Price (Low–High)" },
  { value: "price_desc", label: "Price (High–Low)" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; sort?: string }>;
}) {
  const { page, q, sort } = await searchParams;
  const requestedPage = Number(page) || 1;
  const { products, pageCount, currentPage, totalCount, sort: resolvedSort } =
    await getAllProducts(requestedPage, q, sort);

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    if (q) params.set("q", q);
    if (resolvedSort !== DEFAULT_PRODUCT_SORT) params.set("sort", resolvedSort);
    return `/products?${params}`;
  };

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

      <ListFilterBar
        basePath="/products"
        initialQuery={q ?? ""}
        initialSort={resolvedSort}
        defaultSort={DEFAULT_PRODUCT_SORT}
        sortOptions={SORT_OPTIONS}
        searchPlaceholder="Search by name or reference..."
      />

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

      <Pagination currentPage={currentPage} pageCount={pageCount} hrefForPage={pageHref} />
    </div>
  );
}
