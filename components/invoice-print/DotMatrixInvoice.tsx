"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { computeLineTotal } from "@/lib/invoice-math";
import { amountToWords } from "@/lib/number-to-words";
import { formatInvoiceDate } from "@/lib/date-format";
import { formatPhone } from "@/lib/phone-format";
import {
  DM_LAYOUT,
  DM_PAGE_WIDTH_MM,
  DM_PAGE_HEIGHT_MM,
  resolvePosition,
  itemRowFieldPos,
  paginateItems,
  type DmCalibration,
  type FieldPos,
} from "@/lib/dot-matrix-layout";

type PreviewItem = {
  reference: string;
  name: string;
  price: number;
  quantity: number;
};

type BillTo = {
  name: string;
  phone: string;
  address: string;
  taxId: string;
};

export type DotMatrixInvoiceProps = {
  calibration: DmCalibration;
  invoiceNo?: string;
  date?: Date;
  dateOfDelivery?: Date | null;
  placeOfSupply?: string | null;
  modeOfPayment?: string | null;
  additionalInfo?: string | null;
  billTo: BillTo;
  items: PreviewItem[];
  taxEnabled: boolean;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  showControls?: boolean;
  showBackgroundImage?: boolean;
};

// Reused across calls instead of creating a new <canvas> per measurement.
let measureCanvas: HTMLCanvasElement | null = null;

/** Width of `text` in mm when rendered at `fontSizePt`, via canvas measureText. Same mm-to-px ratio (96/25.4) used elsewhere in this file. Returns null during SSR — no canvas available until the client's first paint. */
function measureTextWidthMm(text: string, fontSizePt: number): number | null {
  if (typeof document === "undefined") return null;
  if (!measureCanvas) measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d");
  if (!ctx) return null;
  ctx.font = `${fontSizePt}pt Arial, Helvetica, sans-serif`;
  return (ctx.measureText(text).width * 25.4) / 96;
}

/** One greedy width-fitting pass: grows `text` word by word while it fits within `maxWidthMm`, returning the fitted line and whatever's left over. */
function fitOneLine(
  text: string,
  maxWidthMm: number,
  fontSizePt: number
): { line: string; rest: string } {
  const words = text.split(" ");
  let line = "";
  let splitIndex = words.length;
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    const candidateWidth = measureTextWidthMm(candidate, fontSizePt) ?? 0;
    if (line && candidateWidth > maxWidthMm) {
      splitIndex = i;
      break;
    }
    line = candidate;
    splitIndex = i + 1;
  }
  return { line, rest: words.slice(splitIndex).join(" ").trim() };
}

/**
 * Splits `text` across up to `maxLines` lines so each line but the last
 * fits within `maxWidthMm` at `fontSizePt`, breaking at the last word
 * boundary that fits rather than a fixed character count — a character
 * count alone under-splits wide text like an all-caps name (each character
 * is wider than in typical mixed-case text), letting it overflow off the
 * page instead of wrapping. The final line is never width-limited, so
 * text still too long even after `maxLines - 1` wraps just overflows there
 * rather than being truncated or wrapping indefinitely. Falls back to a
 * rough character-count split during SSR (before canvas measurement is
 * available), corrected on the client's first paint.
 */
function splitLines(
  text: string,
  maxWidthMm: number,
  fontSizePt: number,
  maxLines: number
): string[] {
  if (measureTextWidthMm(text, fontSizePt) === null) {
    // SSR fallback — same rough character-count heuristic every line used before.
    const maxLen = 32;
    const lines: string[] = [];
    let remaining = text;
    while (remaining.length > maxLen && lines.length < maxLines - 1) {
      const breakIdx = remaining.lastIndexOf(" ", maxLen);
      const idx = breakIdx > 0 ? breakIdx : maxLen;
      lines.push(remaining.slice(0, idx).trim());
      remaining = remaining.slice(idx).trim();
    }
    lines.push(remaining);
    return lines;
  }

  const lines: string[] = [];
  let remaining = text;
  while (lines.length < maxLines - 1) {
    const width = measureTextWidthMm(remaining, fontSizePt) ?? 0;
    if (width <= maxWidthMm) break;
    const { line, rest } = fitOneLine(remaining, maxWidthMm, fontSizePt);
    lines.push(line);
    remaining = rest;
  }
  lines.push(remaining);
  return lines;
}

/**
 * dmOffsetXMm/dmOffsetYMm/dmScaleX/dmScaleY exist to compensate for how the
 * *physical printer* misplaces things — they have no relevance on screen,
 * where the preview is compared directly against the reference background
 * image, not a real print. Applying them there just makes the preview drift
 * away from that reference for no reason. dmFontSizePt/dmItemRowMm are real
 * physical measurements (not error-compensation), so those still apply
 * everywhere.
 */
function screenCalibration(calibration: DmCalibration): DmCalibration {
  return { ...calibration, dmOffsetXMm: 0, dmOffsetYMm: 0, dmScaleX: 1, dmScaleY: 1 };
}

function Field({
  pos,
  calibration,
  children,
  maxWidthMm,
  truncateWidthMm,
}: {
  pos: FieldPos;
  calibration: DmCalibration;
  children: React.ReactNode;
  /** When set, text wraps within this width instead of overflowing off the page. Anchors to the top (not vertically centered) so wrapped lines only grow downward into the blank space below. Use for fields with blank space below them (e.g. Additional Information). */
  maxWidthMm?: number;
  /** When set, text is clipped with an ellipsis at this width instead of overflowing. Use for single-line fields with no room to wrap (e.g. item table cells, where wrapping would collide with the next row). */
  truncateWidthMm?: number;
}) {
  const wrap = maxWidthMm !== undefined;
  const truncate = truncateWidthMm !== undefined;

  function renderAt(
    resolved: { leftMm: number; topMm: number; align: "left" | "right" },
    visibilityClassName: string
  ) {
    const { leftMm, topMm, align } = resolved;
    return (
      <div
        className={visibilityClassName}
        style={{
          position: "absolute",
          left: `${leftMm}mm`,
          top: `${topMm}mm`,
          fontSize: `${calibration.dmFontSizePt}pt`,
          whiteSpace: wrap ? "normal" : "nowrap",
          overflowWrap: wrap ? "break-word" : undefined,
          maxWidth: wrap ? `${maxWidthMm}mm` : truncate ? `${truncateWidthMm}mm` : undefined,
          overflow: truncate ? "hidden" : undefined,
          textOverflow: truncate ? "ellipsis" : undefined,
          lineHeight: wrap ? 1.3 : undefined,
          transform: wrap
            ? align === "right"
              ? "translateX(-100%)"
              : undefined
            : align === "right"
              ? "translate(-100%, -50%)"
              : "translate(0, -50%)",
          color: "#000",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <>
      {renderAt(resolvePosition(pos, screenCalibration(calibration)), "print:hidden")}
      {renderAt(resolvePosition(pos, calibration), "hidden print:block")}
    </>
  );
}

// Sampled from the shop's own header text in the reference photo (public/pre-printed-invoice-form.jpg).
const SHOP_BLUE = "#004EA3";

/**
 * The dot-matrix printer only prints black — it can't lay down a solid
 * color fill, so the rounded blue pill is screen-only (matches how the old
 * paper stock used to have it pre-printed). What actually prints is plain
 * bold text at the same position, same as every other field here.
 */
function TaxInvoiceBadge({
  pos,
  calibration,
}: {
  pos: FieldPos;
  calibration: DmCalibration;
}) {
  const screen = resolvePosition(pos, screenCalibration(calibration));
  const print = resolvePosition(pos, calibration);
  return (
    <>
      <div
        className="print:hidden"
        style={{
          position: "absolute",
          left: `${screen.leftMm}mm`,
          top: `${screen.topMm}mm`,
          transform: "translate(0, -50%)",
          backgroundColor: SHOP_BLUE,
          color: "#fff",
          fontWeight: 700,
          fontSize: `${calibration.dmFontSizePt}pt`,
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: "1.2mm 4mm",
          borderRadius: "3mm",
          whiteSpace: "nowrap",
        }}
      >
        TAX INVOICE
      </div>
      <div
        className="hidden print:block"
        style={{
          position: "absolute",
          left: `${print.leftMm}mm`,
          top: `${print.topMm}mm`,
          transform: "translate(0, -50%)",
          fontWeight: 700,
          fontSize: `${calibration.dmFontSizePt}pt`,
          fontFamily: "Arial, Helvetica, sans-serif",
          whiteSpace: "nowrap",
          color: "#000",
        }}
      >
        TAX INVOICE
      </div>
    </>
  );
}

export default function DotMatrixInvoice({
  calibration,
  invoiceNo,
  date,
  dateOfDelivery,
  placeOfSupply,
  modeOfPayment,
  additionalInfo,
  billTo,
  items,
  taxEnabled,
  taxPercent,
  subtotal,
  taxAmount,
  total,
  showControls = true,
  showBackgroundImage = true,
}: DotMatrixInvoiceProps) {
  const invoiceDate = date ?? new Date();
  // Purchaser name/address share the same left position on the form, so the
  // same safe width to the true page edge applies to both.
  const PURCHASER_FIELD_MAX_WIDTH_MM = 78;
  // A few mm under the true limit when deciding *where* to wrap — canvas
  // measureText() can differ slightly from the actual DOM-rendered width
  // (kerning/hinting), so a line measured as just barely fitting could still
  // overflow in the real render. Wrapping a little early avoids that.
  // truncateWidthMm={PURCHASER_FIELD_MAX_WIDTH_MM} below is the backstop for
  // the rare case a single word alone is still too wide even after that.
  const PURCHASER_FIELD_WRAP_WIDTH_MM = PURCHASER_FIELD_MAX_WIDTH_MM - 4;
  const [addrLine1, addrLine2] = splitLines(
    billTo.address,
    PURCHASER_FIELD_WRAP_WIDTH_MM,
    calibration.dmFontSizePt,
    2
  );
  const [nameLine1, nameLine2, nameLine3] = splitLines(
    billTo.name,
    PURCHASER_FIELD_WRAP_WIDTH_MM,
    calibration.dmFontSizePt,
    3
  );
  // Each extra name line pushes the whole address block down by one more
  // row to make room, rather than overlapping it.
  const purchaserRowGapPct = DM_LAYOUT.purchaserAddress.yPct - DM_LAYOUT.purchaserName.yPct;
  const extraNameLines = nameLine3 ? 2 : nameLine2 ? 1 : 0;
  const purchaserAddressPos = extraNameLines
    ? { ...DM_LAYOUT.purchaserAddress, yPct: DM_LAYOUT.purchaserAddress.yPct + purchaserRowGapPct * extraNameLines }
    : DM_LAYOUT.purchaserAddress;
  const purchaserAddressLine2Pos = extraNameLines
    ? {
        ...DM_LAYOUT.purchaserAddressLine2,
        yPct: DM_LAYOUT.purchaserAddressLine2.yPct + purchaserRowGapPct * extraNameLines,
      }
    : DM_LAYOUT.purchaserAddressLine2;
  // In the rare case a long name AND a two-line address both need extra
  // rows, the shifted address can land at or past Telephone's row and
  // visually merge into it, making both unreadable. Rather than cascading
  // Telephone (and everything after it) further down too, just skip
  // printing it — the shop enters it in Additional Information instead
  // when this happens.
  const lastAddressLineYPct = addrLine2 ? purchaserAddressLine2Pos.yPct : purchaserAddressPos.yPct;
  const suppressPhone = lastAddressLineYPct >= DM_LAYOUT.purchaserPhone.yPct - purchaserRowGapPct;
  const pages = paginateItems(items, calibration.dmItemRowMm);
  // Cumulative subtotal of every page before this one — page N>0 shows this
  // as a "Balance B/F" line ahead of its own items, and rolls it
  // into its own page total, so the next page's balance stays consistent.
  const balanceBroughtForward: number[] = [];
  {
    let running = 0;
    for (const pageItems of pages) {
      balanceBroughtForward.push(running);
      running += pageItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
    }
  }

  // Scales the whole preview down to fit whatever width its container
  // actually has, like a real print-preview does — the paper size itself
  // (DM_PAGE_WIDTH_MM) is fixed/non-negotiable (it has to match the real
  // stationery), so when the container is narrower, shrinking visually is
  // the alternative to a horizontal scrollbar hiding part of the page.
  // 96/25.4 is the CSS spec's defined mm-to-px ratio for absolute units,
  // not a guess — reliable across browsers.
  const pageWidthPx = (DM_PAGE_WIDTH_MM * 96) / 25.4;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / pageWidthPx));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidthPx]);

  return (
    // Deliberately plain block layout (space-y-*, not flex flex-col gap-*)
    // all the way down to the .dm-page elements — Chromium's print engine
    // doesn't reliably fragment flex containers across pages, and a flex
    // ancestor here caused stray blank pages between real ones. Keep any
    // future wrapper here block-level for the same reason.
    <div className="space-y-4">
      <style>{`@page { size: ${DM_PAGE_WIDTH_MM}mm ${DM_PAGE_HEIGHT_MM}mm; margin: 0; }`}</style>
      {showControls && (
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Pre-printed Form Preview — printing sends only the data, not this image
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

      <div
        ref={containerRef}
        style={{ "--dm-scale": scale } as React.CSSProperties}
        className="space-y-6 print:space-y-0"
      >
        {pages.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === pages.length - 1;
          const balanceForward = balanceBroughtForward[pageIndex];
          const hasBalanceForward = pageIndex > 0;
          // Row 0 is reserved for the "Balance B/F" line on
          // continuation pages (paginateItems already left that row empty),
          // so this page's own items start one row lower there.
          const itemRowOffset = hasBalanceForward ? 1 : 0;
          // Non-last pages show only this page's own running total (balance
          // forward + its own items), not the invoice grand subtotal —
          // VAT/grand total/amount-in-words only make sense once every item
          // across every page is accounted for, so those stay last-page-only.
          const pageSubtotal =
            balanceForward + pageItems.reduce((sum, item) => sum + computeLineTotal(item), 0);
          return (
            <div key={pageIndex} className="space-y-2">
              {pages.length > 1 && (
                <div className="text-xs font-medium text-muted-foreground print:hidden">
                  Page {pageIndex + 1} of {pages.length}
                  {!isLastPage ? " — continued on next page" : ""}
                </div>
              )}
              {/* Reserves the visually-scaled height in the layout (the
                  transform below doesn't shrink the space the element would
                  otherwise occupy) and clips any rounding overflow. Reset
                  to the real size for actual printing. */}
              <div
                className={`overflow-hidden print:h-auto print:overflow-visible [height:calc(${DM_PAGE_HEIGHT_MM}mm*var(--dm-scale,1))]`}
              >
                <div
                  className="dm-page relative bg-white origin-top-left [transform:scale(var(--dm-scale,1))] print:[transform:none]"
                  style={{
                    width: `${DM_PAGE_WIDTH_MM}mm`,
                    height: `${DM_PAGE_HEIGHT_MM}mm`,
                  breakAfter: !isLastPage ? "page" : undefined,
                }}
              >
                {showBackgroundImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/pre-printed-invoice-form.jpg"
                    alt=""
                    className="print:hidden"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      pointerEvents: "none",
                    }}
                  />
                )}

                <Field pos={DM_LAYOUT.dateOfInvoice} calibration={calibration}>
                  {formatInvoiceDate(invoiceDate)}
                </Field>
                {taxEnabled && (
                  <>
                    <TaxInvoiceBadge pos={DM_LAYOUT.taxInvoiceLabel} calibration={calibration} />
                    <Field pos={DM_LAYOUT.taxInvoiceNoLabel} calibration={calibration}>
                      Tax Invoice No. :
                    </Field>
                    <Field pos={DM_LAYOUT.invoiceNo} calibration={calibration}>
                      {/* Real invoices are only ever printed after saving, so this only
                          shows pre-save, while drafting a New Invoice — the number
                          isn't generated until the actual save (it's assigned from a
                          count-of-today's-invoices + retry-on-conflict check, so it
                          can't be safely known ahead of time with 3 terminals saving
                          concurrently). A stale/guessed number here would be worse
                          than an honest placeholder. */}
                      {invoiceNo || "(assigned on save)"}
                    </Field>
                  </>
                )}

                <Field pos={DM_LAYOUT.purchaserTin} calibration={calibration}>
                  {billTo.taxId}
                </Field>
                <Field
                  pos={DM_LAYOUT.purchaserName}
                  calibration={calibration}
                  // Only truncate when a line after this one exists — this
                  // line was meant to be width-fitted by splitLines, so the
                  // truncation here is just a backstop for the rare case its
                  // canvas-measured width was slightly optimistic. The
                  // actual last line for this name is intentionally left
                  // unbounded (may overflow rather than lose text).
                  truncateWidthMm={nameLine2 ? PURCHASER_FIELD_MAX_WIDTH_MM : undefined}
                >
                  {nameLine1}
                </Field>
                {nameLine2 && (
                  <Field
                    pos={DM_LAYOUT.purchaserNameLine2}
                    calibration={calibration}
                    truncateWidthMm={nameLine3 ? PURCHASER_FIELD_MAX_WIDTH_MM : undefined}
                  >
                    {nameLine2}
                  </Field>
                )}
                {nameLine3 && (
                  <Field pos={DM_LAYOUT.purchaserNameLine3} calibration={calibration}>
                    {nameLine3}
                  </Field>
                )}
                <Field
                  pos={purchaserAddressPos}
                  calibration={calibration}
                  truncateWidthMm={addrLine2 ? PURCHASER_FIELD_MAX_WIDTH_MM : undefined}
                >
                  {addrLine1}
                </Field>
                {addrLine2 && (
                  <Field pos={purchaserAddressLine2Pos} calibration={calibration}>
                    {addrLine2}
                  </Field>
                )}
                {!suppressPhone && (
                  <Field pos={DM_LAYOUT.purchaserPhone} calibration={calibration}>
                    {formatPhone(billTo.phone)}
                  </Field>
                )}

                <Field pos={DM_LAYOUT.dateOfDelivery} calibration={calibration}>
                  {dateOfDelivery ? formatInvoiceDate(dateOfDelivery) : ""}
                </Field>
                <Field pos={DM_LAYOUT.placeOfSupply} calibration={calibration}>
                  {placeOfSupply ?? ""}
                </Field>
                <Field pos={DM_LAYOUT.additionalInfo} calibration={calibration} maxWidthMm={140}>
                  {additionalInfo ?? ""}
                </Field>

                {hasBalanceForward && (
                  <div>
                    <Field
                      pos={itemRowFieldPos(DM_LAYOUT.itemsColDescription, 0, calibration.dmItemRowMm)}
                      calibration={calibration}
                      truncateWidthMm={88}
                    >
                      Balance B/F
                    </Field>
                    <Field
                      pos={itemRowFieldPos(DM_LAYOUT.itemsColAmount, 0, calibration.dmItemRowMm)}
                      calibration={calibration}
                    >
                      {balanceForward.toFixed(2)}
                    </Field>
                  </div>
                )}
                {pageItems.map((item, index) => (
                  <div key={index}>
                    <Field
                      pos={itemRowFieldPos(
                        DM_LAYOUT.itemsColRef,
                        index + itemRowOffset,
                        calibration.dmItemRowMm
                      )}
                      calibration={calibration}
                      truncateWidthMm={17}
                    >
                      {item.reference}
                    </Field>
                    <Field
                      pos={itemRowFieldPos(
                        DM_LAYOUT.itemsColDescription,
                        index + itemRowOffset,
                        calibration.dmItemRowMm
                      )}
                      calibration={calibration}
                      truncateWidthMm={88}
                    >
                      {item.name}
                    </Field>
                    <Field
                      pos={itemRowFieldPos(
                        DM_LAYOUT.itemsColQty,
                        index + itemRowOffset,
                        calibration.dmItemRowMm
                      )}
                      calibration={calibration}
                    >
                      {item.quantity}
                    </Field>
                    <Field
                      pos={itemRowFieldPos(
                        DM_LAYOUT.itemsColUnitPrice,
                        index + itemRowOffset,
                        calibration.dmItemRowMm
                      )}
                      calibration={calibration}
                    >
                      {item.price.toFixed(2)}
                    </Field>
                    <Field
                      pos={itemRowFieldPos(
                        DM_LAYOUT.itemsColAmount,
                        index + itemRowOffset,
                        calibration.dmItemRowMm
                      )}
                      calibration={calibration}
                    >
                      {computeLineTotal(item).toFixed(2)}
                    </Field>
                  </div>
                ))}

                <Field pos={DM_LAYOUT.totalValueOfSupply} calibration={calibration}>
                  {(isLastPage ? subtotal : pageSubtotal).toFixed(2)}
                </Field>
                {isLastPage && (
                  <>
                    <Field pos={DM_LAYOUT.vatPercent} calibration={calibration}>
                      {taxEnabled ? taxPercent : 0}%
                    </Field>
                    <Field pos={DM_LAYOUT.vatAmount} calibration={calibration}>
                      {taxAmount.toFixed(2)}
                    </Field>
                    <Field pos={DM_LAYOUT.totalIncludingVat} calibration={calibration}>
                      {total.toFixed(2)}
                    </Field>

                    <Field pos={DM_LAYOUT.amountInWords} calibration={calibration}>
                      {amountToWords(total)}
                    </Field>
                    <Field pos={DM_LAYOUT.modeOfPayment} calibration={calibration}>
                      {modeOfPayment ?? ""}
                    </Field>
                  </>
                )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
