import Link from "next/link";
import { Plus, X } from "lucide-react";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import { getAllInvoices, type InvoiceTaxFolder } from "@/lib/invoices";

const TAX_FOLDERS: { value: InvoiceTaxFolder; label: string }[] = [
  { value: "all", label: "All Invoices" },
  { value: "vat", label: "VAT Bills" },
  { value: "no-vat", label: "No VAT Bills" },
];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; folder?: string }>;
}) {
  const { page, q, folder } = await searchParams;
  const requestedPage = Number(page) || 1;
  const taxFolder: InvoiceTaxFolder = TAX_FOLDERS.some((f) => f.value === folder)
    ? (folder as InvoiceTaxFolder)
    : "all";
  const { invoices, pageCount, currentPage } = await getAllInvoices(
    requestedPage,
    q,
    taxFolder
  );

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    if (q) params.set("q", q);
    if (taxFolder !== "all") params.set("folder", taxFolder);
    return `/invoices?${params.toString()}`;
  };
  const folderHref = (value: InvoiceTaxFolder) => {
    const params = new URLSearchParams();
    if (value !== "all") params.set("folder", value);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };

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

      <div className="flex gap-1 print:hidden">
        {TAX_FOLDERS.map((f) => (
          <Link
            key={f.value}
            href={folderHref(f.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              taxFolder === f.value
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-surface-muted"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <RecentInvoicesTable
        title={
          q
            ? "Matching Invoices"
            : (TAX_FOLDERS.find((f) => f.value === taxFolder)?.label ?? "All Invoices")
        }
        invoices={invoices}
        emptyMessage={
          q
            ? "No invoices match your search."
            : taxFolder === "vat"
              ? "No VAT invoices yet."
              : taxFolder === "no-vat"
                ? "No non-VAT invoices yet."
                : "No invoices yet. Create your first invoice to see it here."
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
