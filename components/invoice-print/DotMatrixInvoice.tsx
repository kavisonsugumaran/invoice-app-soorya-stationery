"use client";

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

function splitTwoLines(text: string, maxLen = 32): [string, string] {
  if (text.length <= maxLen) return [text, ""];
  const breakIdx = text.lastIndexOf(" ", maxLen);
  const idx = breakIdx > 0 ? breakIdx : maxLen;
  return [text.slice(0, idx).trim(), text.slice(idx).trim()];
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
  const { leftMm, topMm, align } = resolvePosition(pos, calibration);
  const wrap = maxWidthMm !== undefined;
  const truncate = truncateWidthMm !== undefined;
  return (
    <div
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
  const { leftMm, topMm } = resolvePosition(pos, calibration);
  return (
    <>
      <div
        className="print:hidden"
        style={{
          position: "absolute",
          left: `${leftMm}mm`,
          top: `${topMm}mm`,
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
          left: `${leftMm}mm`,
          top: `${topMm}mm`,
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
  const [addrLine1, addrLine2] = splitTwoLines(billTo.address);

  return (
    <div className="flex flex-col gap-4">
      <style>{`@page { size: ${DM_PAGE_WIDTH_MM}mm ${DM_PAGE_HEIGHT_MM}mm; margin: 0; }`}</style>
      {showControls && (
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Pre-printed Form Preview — printing sends only the data, not this image
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
        className="dm-page relative bg-white"
        style={{ width: `${DM_PAGE_WIDTH_MM}mm`, height: `${DM_PAGE_HEIGHT_MM}mm` }}
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
        <Field pos={DM_LAYOUT.purchaserName} calibration={calibration}>
          {billTo.name}
        </Field>
        <Field pos={DM_LAYOUT.purchaserAddress} calibration={calibration}>
          {addrLine1}
        </Field>
        {addrLine2 && (
          <Field pos={DM_LAYOUT.purchaserAddressLine2} calibration={calibration}>
            {addrLine2}
          </Field>
        )}
        <Field pos={DM_LAYOUT.purchaserPhone} calibration={calibration}>
          {formatPhone(billTo.phone)}
        </Field>

        <Field pos={DM_LAYOUT.dateOfDelivery} calibration={calibration}>
          {dateOfDelivery ? formatInvoiceDate(dateOfDelivery) : ""}
        </Field>
        <Field pos={DM_LAYOUT.placeOfSupply} calibration={calibration}>
          {placeOfSupply ?? ""}
        </Field>
        <Field pos={DM_LAYOUT.additionalInfo} calibration={calibration} maxWidthMm={140}>
          {additionalInfo ?? ""}
        </Field>

        {items.map((item, index) => (
          <div key={index}>
            <Field
              pos={itemRowFieldPos(DM_LAYOUT.itemsColRef, index, calibration.dmItemRowMm)}
              calibration={calibration}
              truncateWidthMm={17}
            >
              {item.reference}
            </Field>
            <Field
              pos={itemRowFieldPos(DM_LAYOUT.itemsColDescription, index, calibration.dmItemRowMm)}
              calibration={calibration}
              truncateWidthMm={88}
            >
              {item.name}
            </Field>
            <Field
              pos={itemRowFieldPos(DM_LAYOUT.itemsColQty, index, calibration.dmItemRowMm)}
              calibration={calibration}
            >
              {item.quantity}
            </Field>
            <Field
              pos={itemRowFieldPos(DM_LAYOUT.itemsColUnitPrice, index, calibration.dmItemRowMm)}
              calibration={calibration}
            >
              {item.price.toFixed(2)}
            </Field>
            <Field
              pos={itemRowFieldPos(DM_LAYOUT.itemsColAmount, index, calibration.dmItemRowMm)}
              calibration={calibration}
            >
              {computeLineTotal(item).toFixed(2)}
            </Field>
          </div>
        ))}

        <Field pos={DM_LAYOUT.totalValueOfSupply} calibration={calibration}>
          {subtotal.toFixed(2)}
        </Field>
        <Field pos={DM_LAYOUT.vatPercent} calibration={calibration}>
          {taxEnabled ? taxPercent : 0}
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
      </div>
    </div>
  );
}
