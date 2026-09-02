"use client";

import { Printer } from "lucide-react";
import { computeLineTotal, splitRupeesCents } from "@/lib/invoice-math";
import { formatInvoiceDate } from "@/lib/date-format";

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
  total: number;
  showControls?: boolean;
};

const PAGE_SIZE_IN = 5.5;
// Left/right margin is more generous than top/bottom, matching how much
// blank border the reference pre-printed pad actually shows around the
// ruled table — plain top/bottom-only spacing (the old single 8mm value)
// left the table looking edge-to-edge on the sides by comparison.
const BASE_MARGIN_TOP_MM = 8;
const BASE_MARGIN_SIDE_MM = 12;

export default function SmallBillPrint({
  business,
  calibration,
  invoiceNo,
  date,
  billToName,
  items,
  total,
  showControls = true,
}: SmallBillPrintProps) {
  const billDate = date ?? new Date();
  const marginTopMm = BASE_MARGIN_TOP_MM + calibration.smallBillOffsetYMm;
  const marginLeftMm = BASE_MARGIN_SIDE_MM + calibration.smallBillOffsetXMm;
  const totalSplit = splitRupeesCents(total);

  return (
    // Plain block layout (space-y-3, not flex) — same Chromium print-
    // pagination safety reasoning as InvoicePreview.tsx/DotMatrixInvoice.tsx.
    // Unlike DotMatrixInvoice, this renders a complete document from
    // scratch (no pre-printed letterhead to overlay onto), so there's a
    // single render path — no screen/print divergence, no
    // lib/dot-matrix-layout.ts, no absolute positioning.
    <div className="w-full space-y-3">
      <style>{`@page { size: ${PAGE_SIZE_IN}in ${PAGE_SIZE_IN}in; margin: ${marginTopMm}mm ${marginLeftMm}mm; }`}</style>
      {showControls && (
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground">Small Bill Preview</h2>
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

      <div className="small-bill-document rounded-md border bg-white p-6 text-[#004EA3] print:border-0 print:p-0 print:shadow-none">
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
          {business?.address && <p className="text-[10px] leading-tight">{business.address}</p>}
          <p className="text-[10px] leading-tight">
            {[business?.phone, business?.email].filter(Boolean).join("  |  ")}
          </p>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest">Cash / Credit Memo</p>
        </div>

        {/* M/s. + Date */}
        <div className="flex items-end justify-between gap-3 border-t border-b border-black py-1.5 text-xs">
          <div className="flex flex-1 items-baseline gap-1">
            <span className="font-bold">M/s.</span>
            <span className="flex-1 border-b border-dotted border-black break-words">
              {billToName || " "}
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
              <th className="border-r border-black px-1 py-1 text-left font-bold">Description</th>
              <th className="border-r border-black px-1 py-1 text-right font-bold">Rate</th>
              <th className="border-r border-black px-1 py-1 text-right font-bold">Rs.</th>
              <th className="px-1 py-1 text-right font-bold">Cts.</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="h-16 px-1 py-1 text-center text-muted-foreground">
                  No items added
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                const { rupees, cents } = splitRupeesCents(computeLineTotal(item));
                return (
                  <tr key={index} className="break-inside-avoid border-b border-black/40">
                    <td className="border-r border-black px-1 py-1">{item.quantity}</td>
                    <td className="border-r border-black px-1 py-1">{item.name || "Item name"}</td>
                    <td className="border-r border-black px-1 py-1 text-right">
                      {item.price.toFixed(2)}
                    </td>
                    <td className="border-r border-black px-1 py-1 text-right">{rupees}</td>
                    <td className="px-1 py-1 text-right">{cents}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Bottom row: bill number + total */}
        <div className="flex items-center justify-between border-t-2 border-black pt-1.5 text-xs">
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
}
