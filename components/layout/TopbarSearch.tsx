"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

// Keyed by activeQuery so navigating to a new/cleared search remounts this
// with fresh local state, instead of syncing it via an effect.
function SearchForm({ activeQuery }: { activeQuery: string }) {
  const router = useRouter();
  const [q, setQ] = useState(activeQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    router.push(trimmed ? `/invoices?q=${encodeURIComponent(trimmed)}` : "/invoices");
  }

  function handleClear() {
    setQ("");
    if (activeQuery) router.push("/invoices");
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 max-w-sm">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search invoices, customers..."
          // A browser extension (typically a password manager) injects a
          // fdprocessedid attribute onto inputs before React hydrates, which
          // otherwise trips a false-positive hydration mismatch warning here.
          suppressHydrationWarning
          className="w-full rounded-lg border border-border bg-surface-muted py-2 pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </form>
  );
}

export default function TopbarSearch() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The topbar always searches invoices — only reflect ?q= when actually on
  // that page, so this doesn't pick up an unrelated q from e.g. /customers.
  const activeQuery = pathname === "/invoices" ? (searchParams.get("q") ?? "") : "";

  return <SearchForm key={activeQuery} activeQuery={activeQuery} />;
}
