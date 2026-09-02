import Link from "next/link";
import { Plus, X } from "lucide-react";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import Pagination from "@/components/ui/Pagination";
import StatusDateFilterBar from "@/components/ui/StatusDateFilterBar";
import { getAllInvoices, type InvoiceTaxFolder } from "@/lib/invoices";
import type { InvoiceStatus } from "@prisma/client";

const TAX_FOLDERS: { value: InvoiceTaxFolder; label: string }[] = [
  { value: "all", label: "All Invoices" },
  { value: "vat", label: "VAT Bills" },
  { value: "no-vat", label: "Non VAT Bills" },
];

const STATUS_VALUES: InvoiceStatus[] = ["UNPAID", "PAID", "CANCELLED"];

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    folder?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { page, q, folder, status, from, to } = await searchParams;
  const requestedPage = Number(page) || 1;
  const taxFolder: InvoiceTaxFolder = TAX_FOLDERS.some((f) => f.value === folder)
    ? (folder as InvoiceTaxFolder)
    : "all";
  const statusFilter = STATUS_VALUES.find((s) => s === status);
  const { invoices, pageCount, currentPage } = await getAllInvoices(
    requestedPage,
    q,
    taxFolder,
    statusFilter,
    from,
    to
  );

  // Every list/filter link below shares this — page position and folder are
  // the only params each control chooses explicitly; status/from/to always
  // carry through unchanged so switching folders (or paging) never drops an
  // active status/date filter, and vice versa.
  const buildHref = (overrides: { page?: number; folder?: InvoiceTaxFolder }) => {
    const params = new URLSearchParams();
    const targetFolder = overrides.folder ?? taxFolder;
    if (overrides.page && overrides.page > 1) params.set("page", String(overrides.page));
    if (q) params.set("q", q);
    if (targetFolder !== "all") params.set("folder", targetFolder);
    if (status) params.set("status", status);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return qs ? `/invoices?${qs}` : "/invoices";
  };
  const pageHref = (targetPage: number) => buildHref({ page: targetPage });
  const folderHref = (value: InvoiceTaxFolder) => buildHref({ folder: value });

  const hasExtraFilters = Boolean(status || from || to);

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

      <StatusDateFilterBar />

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
            : hasExtraFilters
              ? "No invoices match the selected filters."
              : taxFolder === "vat"
                ? "No VAT invoices yet."
                : taxFolder === "no-vat"
                  ? "No non-VAT invoices yet."
                  : "No invoices yet. Create your first invoice to see it here."
        }
      />

      <Pagination currentPage={currentPage} pageCount={pageCount} hrefForPage={pageHref} />
    </div>
  );
}
