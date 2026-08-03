"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export type SortOption = { value: string; label: string };

export default function ListFilterBar({
  basePath,
  initialQuery,
  initialSort,
  defaultSort,
  sortOptions,
  searchPlaceholder,
}: {
  basePath: string;
  initialQuery: string;
  initialSort: string;
  defaultSort: string;
  sortOptions: SortOption[];
  searchPlaceholder: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function navigate(nextQuery: string, nextSort: string) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextSort && nextSort !== defaultSort) params.set("sort", nextSort);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(q, initialSort);
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    navigate(q, e.target.value);
  }

  function handleClear() {
    setQ("");
    router.push(basePath);
  }

  const hasActiveFilters = initialQuery !== "" || initialSort !== defaultSort;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex-1">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </form>

      <select
        aria-label="Sort by"
        value={initialSort}
        onChange={handleSortChange}
        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <X size={14} />
          Clear
        </button>
      )}
    </div>
  );
}
