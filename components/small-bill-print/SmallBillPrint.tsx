"use client";

import { Printer } from "lucide-react";
import { computeLineTotal, splitRupeesCents } from "@/lib/invoice-math";
import { formatInvoiceDate } from "@/lib/date-format";
import { SMALL_BILL_ITEMS_PER_PAGE } from "@/lib/small-bill";

type BusinessInfo = {
  businessName: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
} | null; // no taxId row — small bills never show a TIN, this isn't a VAT document

type SmallBillItem = {
  name: string;
  price: number;
  quantity: number;
};

export type SmallBillCalibration = {
  smallBillOffsetXMm: number;
  smallBillOffsetYMm: number;
};

type SmallBillPrintProps = {
  business: BusinessInfo;
  calibration: SmallBillCalibration;
  invoiceNo?: string;
  date?: Date;
  billToName: string;
  items: SmallBillItem[];
  showControls?: boolean;
};

const PAGE_SIZE_IN = 5.5;
const BASE_MARGIN_TOP_MM = 4;
const BASE_MARGIN_SIDE_MM = 6;
// The reference pad always shows this many ruled rows regardless of how
// many are actually filled in — a fixed pre-printed grid, not one sized to
// the day's items. SMALL_BILL_ITEMS_PER_PAGE (shared with
// createSmallBill(), which is the source of truth for the per-page limit —
// see its own comment) also doubles as this component's blank-row-padding
// target and, defensively, its own internal print-pagination cap: a
// freshly created small bill's Invoice row never actually holds more than
// this many items any more (createSmallBill splits overflow into separate
// invoices instead), but an existing bill edited to grow past the limit
// still needs to render sanely rather than overflow one physical page, so
// the pages.map() below stays as a fallback.
// 13 rows plus the header/M's-Date block genuinely overflowed the padded
// 5.5in box (confirmed against a real printout) — 10 leaves real headroom
// instead of a margin so tight it broke on ordinary font rendering. Raised
// back toward that after trimming the top/bottom margin (8mm -> 4mm) freed
// up enough space for a couple more rows without reintroducing the overflow
// — verify against a real printout before pushing this further.
const ITEMS_PER_PAGE = SMALL_BILL_ITEMS_PER_PAGE;

/** Splits items into pages of at most `perPage`, always returning at least one (possibly empty) page. */
function paginateSmallBillItems<T>(items: T[], perPage: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

export default function SmallBillPrint({
  business,
  calibration,
  invoiceNo,
  date,
  billToName,
  items,
  showControls = true,
}: SmallBillPrintProps) {
  const billDate = date ?? new Date();
  const marginTopMm = BASE_MARGIN_TOP_MM + calibration.smallBillOffsetYMm;
  const marginLeftMm = BASE_MARGIN_SIDE_MM + calibration.smallBillOffsetXMm;
  const pages = paginateSmallBillItems(items, ITEMS_PER_PAGE);

  return (
    // Plain block layout (space-y-3, not flex) — same Chromium print-
    // pagination safety reasoning as InvoicePreview.tsx/DotMatrixInvoice.tsx.
    // Unlike DotMatrixInvoice, this renders a complete document from
    // scratch (no pre-printed letterhead to overlay onto), so there's a
    // single render path — no screen/print divergence, no
    // lib/dot-matrix-layout.ts, no absolute positioning.
    <div className="w-full space-y-3">
      {/* margin: 0 here — each page box below is itself sized to the full
          physical page (PAGE_SIZE_IN x PAGE_SIZE_IN) with its own padding
          creating the visual margin, so screen and print use one consistent
          box instead of the page-level margin doubling up with the box's
          own size. */}
      <style>{`@page { size: ${PAGE_SIZE_IN}in ${PAGE_SIZE_IN}in; margin: 0; }`}</style>
      {showControls && (
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Small Bill Preview
            {pages.length > 1 ? ` (${pages.length} pages)` : ""}
          </h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
          >
            <Printer size={14} />
            Print
          </button>
        </div>
      )}

      <div className="space-y-6 print:space-y-0">
        {pages.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1;
          // Each page is a self-contained bill, not a running/continuation
          // total like the commercial invoice's "Balance B/F" — its total
          // is only the items printed on that page.
          const pageTotal = pageItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
          const totalSplit = splitRupeesCents(pageTotal);

          return (
            <div key={pageIndex} className="space-y-2">
              {pages.length > 1 && (
                <div className="text-xs font-medium text-muted-foreground print:hidden">
                  Page {pageIndex + 1} of {pages.length}
                  {!isLastPage ? " — continued on next page" : ""}
                </div>
              )}
              {/* Fixed to the true physical page size (not shrink-wrapped to
                  content) so a short bill still shows/prints as a full
                  5.5x5.5in sheet, matching the reference pad — mx-auto
                  centers it on screen when the surrounding container is
                  wider than the page itself. */}
              <div
                className="small-bill-document mx-auto flex flex-col rounded-md border bg-white text-[#004EA3] print:mx-0 print:rounded-none print:border-0 print:shadow-none"
                style={{
                  width: `${PAGE_SIZE_IN}in`,
                  height: `${PAGE_SIZE_IN}in`,
                  padding: `${marginTopMm}mm ${marginLeftMm}mm`,
                  // Without this, `height` sets the content box only —
                  // padding and border get added on top, making the real
                  // rendered box taller than 5.5in and pushing the bottom
                  // row past the border. This is what actually caused an
                  // earlier overflow, not just too many rows. Deliberately
                  // not overflow:hidden alongside this: if a single page's
                  // content is ever still too tall (a long wrapped
                  // address), better to visibly grow past the box than
                  // silently clip the totals row.
                  boxSizing: "border-box",
                  breakAfter: !isLastPage ? "page" : undefined,
                }}
              >
                {/* Header */}
                <div className="flex flex-col items-center gap-0.5 pb-2 text-center">
                  <div className="flex items-center gap-2">
                    {business?.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={business.logoUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 object-contain"
                      />
                    )}
                    <h1 className="text-lg font-extrabold uppercase tracking-wide">
                      {business?.businessName || "Your Business Name"}
                    </h1>
                  </div>
                  {business?.address && (
                    <p className="text-[10px] leading-tight">{business.address}</p>
                  )}
                  <p className="text-[10px] leading-tight">
                    {[business?.phone, business?.email].filter(Boolean).join("  |  ")}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest">
                    Cash / Credit Memo
                  </p>
                </div>

                {/* M/s. + Date */}
                <div className="flex items-end justify-between gap-3 border-t border-b border-black py-1.5 text-xs">
                  <div className="flex flex-1 items-baseline gap-1">
                    <span className="font-bold">M/s.</span>
                    <span className="flex-1 border-b border-dotted border-black break-words">
                      {billToName || " "}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-1">
                    <span className="font-bold">Date:</span>
                    <span>{formatInvoiceDate(billDate)}</span>
                  </div>
                </div>

                {/* Items table */}
                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="border-r border-black px-1 py-1 text-left font-bold">Qty</th>
                      <th className="border-r border-black px-1 py-1 text-left font-bold">
                        Description
                      </th>
                      <th className="border-r border-black px-1 py-1 text-right font-bold">
                        Rate
                      </th>
                      <th className="border-r border-black px-1 py-1 text-right font-bold">
                        Rs.
                      </th>
                      <th className="px-1 py-1 text-right font-bold">Cts.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item, index) => {
                      const { rupees, cents } = splitRupeesCents(computeLineTotal(item));
                      return (
                        <tr key={index} className="break-inside-avoid border-b border-black/40">
                          <td className="border-r border-black px-1 py-1">{item.quantity}</td>
                          <td className="border-r border-black px-1 py-1">
                            {item.name || "Item name"}
                          </td>
                          <td className="border-r border-black px-1 py-1 text-right">
                            {item.price.toFixed(2)}
                          </td>
                          <td className="border-r border-black px-1 py-1 text-right">{rupees}</td>
                          <td className="px-1 py-1 text-right">{cents}</td>
                        </tr>
                      );
                    })}
                    {/* Blank rows padding this page's table up to
                        ITEMS_PER_PAGE, matching the reference pad's fixed
                        ruled grid. &nbsp; keeps each empty cell at the same
                        height as a filled one. */}
                    {Array.from({
                      length: Math.max(0, ITEMS_PER_PAGE - pageItems.length),
                    }).map((_, i) => (
                      <tr key={`blank-${i}`} className="border-b border-black/40">
                        <td className="border-r border-black px-1 py-1">&nbsp;</td>
                        <td className="border-r border-black px-1 py-1">&nbsp;</td>
                        <td className="border-r border-black px-1 py-1 text-right">&nbsp;</td>
                        <td className="border-r border-black px-1 py-1 text-right">&nbsp;</td>
                        <td className="px-1 py-1 text-right">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bottom row: bill number + this page's own total. mt-auto
                    pins it to the bottom of the fixed-height document box
                    regardless of exactly how tall the (blank-row-padded)
                    table ends up — a safety net alongside ITEMS_PER_PAGE
                    rather than relying on that count alone. */}
                <div className="mt-auto flex items-center justify-between border-t-2 border-black pt-1.5 text-xs">
                  <span className="font-bold">No. {invoiceNo || "(assigned on save)"}</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span>TOTAL</span>
                    <span>
                      {totalSplit.rupees}.{totalSplit.cents}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
