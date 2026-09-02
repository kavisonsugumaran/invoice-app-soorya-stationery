import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  currentPage: number;
  pageCount: number;
  /** Builds the href for a given page number, e.g. `(p) => pageHref(p)`. */
  hrefForPage: (page: number) => string;
};

/**
 * Numbered page buttons + prev/next chevrons (1 2 3 ... N), replacing the
 * old "Page X of Y" + Previous/Next text-link pattern that used to be
 * duplicated across every list page (invoices, customers, products,
 * small-bills). Always shows page 1 and the last page, plus a window
 * around the current page, collapsing any gap into an ellipsis — so this
 * stays usable even once a list grows into dozens of pages instead of
 * rendering one button per page.
 */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  const pages = new Set<number>([1, total]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);

  const result: (number | "...")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push("...");
    result.push(p);
    previous = p;
  }
  return result;
}

export default function Pagination({ currentPage, pageCount, hrefForPage }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pageNumbers = getPageNumbers(currentPage, pageCount);

  return (
    <nav className="flex items-center justify-center gap-1 text-sm" aria-label="Pagination">
      <Link
        href={hrefForPage(currentPage - 1)}
        aria-disabled={currentPage <= 1}
        aria-label="Previous page"
        className={`flex h-8 w-8 items-center justify-center rounded-md ${
          currentPage <= 1
            ? "pointer-events-none opacity-30"
            : "text-muted-foreground hover:bg-surface-muted"
        }`}
      >
        <ChevronLeft size={16} />
      </Link>

      {pageNumbers.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={page}
            href={hrefForPage(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium ${
              page === currentPage
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-surface-muted"
            }`}
          >
            {page}
          </Link>
        )
      )}

      <Link
        href={hrefForPage(currentPage + 1)}
        aria-disabled={currentPage >= pageCount}
        aria-label="Next page"
        className={`flex h-8 w-8 items-center justify-center rounded-md ${
          currentPage >= pageCount
            ? "pointer-events-none opacity-30"
            : "text-muted-foreground hover:bg-surface-muted"
        }`}
      >
        <ChevronRight size={16} />
      </Link>
    </nav>
  );
}
