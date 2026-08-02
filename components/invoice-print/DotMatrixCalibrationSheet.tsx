"use client";

import { Printer } from "lucide-react";
import {
  DM_LAYOUT,
  DM_PAGE_WIDTH_MM,
  DM_PAGE_HEIGHT_MM,
  resolvePosition,
  itemRowFieldPos,
  type DmCalibration,
  type FieldPos,
} from "@/lib/dot-matrix-layout";

function Mark({
  pos,
  calibration,
  label,
}: {
  pos: FieldPos;
  calibration: DmCalibration;
  label: string;
}) {
  const { leftMm, topMm, align } = resolvePosition(pos, calibration);
  return (
    <div
      style={{
        position: "absolute",
        left: `${leftMm}mm`,
        top: `${topMm}mm`,
        width: "max-content",
        transform: align === "right" ? "translate(-100%, -50%)" : "translate(0, -50%)",
        display: "flex",
        alignItems: "center",
        gap: "2px",
        whiteSpace: "nowrap",
        color: "#000",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {align === "right" && <span style={{ fontSize: "9pt" }}>{label}</span>}
      <span style={{ fontSize: "10pt", lineHeight: 1 }}>+</span>
      {align !== "right" && <span style={{ fontSize: "9pt" }}>{label}</span>}
    </div>
  );
}

const SAMPLE_ITEM_ROWS = 3;

export default function DotMatrixCalibrationSheet({
  calibration,
  showControls = true,
  showBackgroundImage = true,
}: {
  calibration: DmCalibration;
  showControls?: boolean;
  showBackgroundImage?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <style>{`@page { size: ${DM_PAGE_WIDTH_MM}mm ${DM_PAGE_HEIGHT_MM}mm; margin: 0; }`}</style>
      {showControls && (
        <div className="flex items-center justify-between print:hidden">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Calibration Test Sheet — print this on blank paper, then hold it up against the real
            form (e.g. against a window) to see how far each mark is off, and adjust the offsets
            below.
          </h2>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
          >
            <Printer size={14} />
            Print Test Sheet
          </button>
        </div>
      )}

      <div
        className="relative bg-white"
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

        <Mark pos={DM_LAYOUT.dateOfInvoice} calibration={calibration} label="Date of Invoice" />
        <Mark pos={DM_LAYOUT.taxInvoiceLabel} calibration={calibration} label="Tax Invoice (VAT only)" />
        <Mark
          pos={DM_LAYOUT.taxInvoiceNoLabel}
          calibration={calibration}
          label="Tax Invoice No. label (VAT only)"
        />
        <Mark pos={DM_LAYOUT.invoiceNo} calibration={calibration} label="Invoice No." />

        <Mark pos={DM_LAYOUT.purchaserTin} calibration={calibration} label="Purchaser TIN" />
        <Mark pos={DM_LAYOUT.purchaserName} calibration={calibration} label="Purchaser Name" />
        <Mark pos={DM_LAYOUT.purchaserAddress} calibration={calibration} label="Address L1" />
        <Mark
          pos={DM_LAYOUT.purchaserAddressLine2}
          calibration={calibration}
          label="Address L2"
        />
        <Mark pos={DM_LAYOUT.purchaserPhone} calibration={calibration} label="Purchaser Phone" />

        <Mark pos={DM_LAYOUT.dateOfDelivery} calibration={calibration} label="Date of Delivery" />
        <Mark pos={DM_LAYOUT.placeOfSupply} calibration={calibration} label="Place of Supply" />
        <Mark pos={DM_LAYOUT.additionalInfo} calibration={calibration} label="Additional Info" />

        {Array.from({ length: SAMPLE_ITEM_ROWS }).map((_, index) => (
          <div key={index}>
            <Mark
              pos={itemRowFieldPos(DM_LAYOUT.itemsColRef, index, calibration.dmItemRowMm)}
              calibration={calibration}
              label={`Row ${index + 1}: Ref`}
            />
            <Mark
              pos={itemRowFieldPos(
                DM_LAYOUT.itemsColDescription,
                index,
                calibration.dmItemRowMm
              )}
              calibration={calibration}
              label={`Row ${index + 1}: Description`}
            />
            <Mark
              pos={itemRowFieldPos(DM_LAYOUT.itemsColQty, index, calibration.dmItemRowMm)}
              calibration={calibration}
              label="Qty"
            />
            <Mark
              pos={itemRowFieldPos(DM_LAYOUT.itemsColUnitPrice, index, calibration.dmItemRowMm)}
              calibration={calibration}
              label="Unit Price"
            />
            <Mark
              pos={itemRowFieldPos(DM_LAYOUT.itemsColAmount, index, calibration.dmItemRowMm)}
              calibration={calibration}
              label="Amount"
            />
          </div>
        ))}

        <Mark
          pos={DM_LAYOUT.totalValueOfSupply}
          calibration={calibration}
          label="Total Value of Supply"
        />
        <Mark pos={DM_LAYOUT.vatPercent} calibration={calibration} label="VAT %" />
        <Mark pos={DM_LAYOUT.vatAmount} calibration={calibration} label="VAT Amount" />
        <Mark
          pos={DM_LAYOUT.totalIncludingVat}
          calibration={calibration}
          label="Total Incl. VAT"
        />

        <Mark pos={DM_LAYOUT.amountInWords} calibration={calibration} label="Amount in Words" />
        <Mark pos={DM_LAYOUT.modeOfPayment} calibration={calibration} label="Mode of Payment" />
      </div>
    </div>
  );
}
