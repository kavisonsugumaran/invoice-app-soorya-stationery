"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "UNPAID", label: "Unpaid" },
  { value: "PAID", label: "Paid" },
  { value: "CANCELLED", label: "Cancelled" },
];

/**
 * Status + date-range filter, reused by both the Invoices and Small Bills
 * list pages (both share the same InvoiceStatus enum and a `date` field to
 * filter on). Reads/writes status/from/to URL params directly via
 * usePathname()/useSearchParams() rather than taking them as props, so it
 * composes with whatever other params a given page already has (q, folder)
 * without needing them threaded through — same approach TopbarSearch uses.
 */
export default function StatusDateFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    // Any filter change invalidates the current page number.
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("from");
    params.delete("to");
    params.delete("page");
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const hasActiveFilters = status !== "" || from !== "" || to !== "";

  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <label htmlFor="filter-date-from">From</label>
        <input
          id="filter-date-from"
          type="date"
          value={from}
          onChange={(e) => updateParam("from", e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <label htmlFor="filter-date-to">To</label>
        <input
          id="filter-date-to"
          type="date"
          value={to}
          onChange={(e) => updateParam("to", e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X size={14} />
          Clear filters
        </button>
      )}
    </div>
  );
}
