// Layout for printing invoice data onto PRE-PRINTED dot-matrix stationery.
//
// Target printer: Epson LQ-310 (24-pin, USB, tractor-feed capable — has an
// official Windows driver, so printing goes through the normal OS print
// pipeline/browser print dialog, not a raw ESC/P byte stream). It also has a
// physical micro-adjustment feature on the printer itself for nudging paper
// position — use that for coarse alignment before fine-tuning with the
// dmOffsetXMm/dmOffsetYMm values in Settings.
//
// Coordinates are percentages of the page, measured visually against the
// actual reference photo of the stationery (public/pre-printed-invoice-form.webp,
// rendered as the background in DotMatrixInvoice / DotMatrixCalibrationSheet
// on screen). They still have NOT been calibrated against a real printer —
// the image only validates layout proportions, not printer-specific margin
// drift. Use the Settings page's mm offsets for that once real hardware is
// available.
//
// The Supplier's TIN/Name/Address/E-mail/Telephone/Fax are already
// pre-printed on the stationery (they're the shop's own static details) —
// do NOT print over them. Only the Purchaser side and invoice-specific
// fields are blank on the physical form.

// The reference image is 1381x1600px (ratio 0.863), noticeably wider than
// US Letter (0.774) — consistent with standard 9.5in continuous fanfold
// stationery (the extra width is the tractor-feed hole strips on both
// edges), not 8.5in. Height assumed at 11in (standard fanfold page length).
export const DM_PAGE_WIDTH_MM = 241.3; // 9.5in
export const DM_PAGE_HEIGHT_MM = 279; // 11in

export type FieldPos = {
  xPct: number; // % from left edge of the page
  yPct: number; // % from top edge of the page
  align?: "left" | "right";
};

export const DM_LAYOUT = {
  dateOfInvoice: { xPct: 23, yPct: 10.4 } as FieldPos,
  invoiceNo: { xPct: 63.5, yPct: 10.4 } as FieldPos,

  purchaserTin: { xPct: 63.5, yPct: 13.8 } as FieldPos,
  purchaserName: { xPct: 63.7, yPct: 15.6 } as FieldPos,
  purchaserAddress: { xPct: 63.5, yPct: 17.5 } as FieldPos, // wraps onto purchaserAddressLine2 below if long
  purchaserAddressLine2: { xPct: 63.5, yPct: 19.3 } as FieldPos,
  purchaserPhone: { xPct: 63.5, yPct: 23.9 } as FieldPos,

  dateOfDelivery: { xPct: 23, yPct: 27.3 } as FieldPos,
  placeOfSupply: { xPct: 63.5, yPct: 27.3 } as FieldPos,
  additionalInfo: { xPct: 29.5, yPct: 29.3 } as FieldPos,

  // Items table: row Y = itemsFirstRowYPct + (rowIndex * dmItemRowMm converted to %)
  itemsFirstRowYPct: 41,
  itemsColRef: { xPct: 9, yPct: 0, align: "left" } as FieldPos,
  itemsColDescription: { xPct: 18, yPct: 0, align: "left" } as FieldPos,
  itemsColQty: { xPct: 65, yPct: 0, align: "right" } as FieldPos,
  itemsColUnitPrice: { xPct: 75, yPct: 0, align: "right" } as FieldPos,
  itemsColAmount: { xPct: 91, yPct: 0, align: "right" } as FieldPos,

  totalValueOfSupply: { xPct: 91, yPct: 75.5, align: "right" } as FieldPos,
  vatPercent: { xPct: 35, yPct: 78.8 } as FieldPos, // fills the blank inside "...@   %)"
  vatAmount: { xPct: 91, yPct: 78.8, align: "right" } as FieldPos,
  totalIncludingVat: { xPct: 91, yPct: 82.0, align: "right" } as FieldPos,

  amountInWords: { xPct: 28, yPct: 85.4 } as FieldPos,
  modeOfPayment: { xPct: 28, yPct: 88.4 } as FieldPos,
} as const;

export type DmCalibration = {
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
};

/** Returns the field position for a given item table row, based on the configured row height. */
export function itemRowFieldPos(col: FieldPos, rowIndex: number, itemRowMm: number): FieldPos {
  const rowOffsetPct = ((rowIndex * itemRowMm) / DM_PAGE_HEIGHT_MM) * 100;
  return { ...col, yPct: DM_LAYOUT.itemsFirstRowYPct + rowOffsetPct };
}

/** Converts a layout field position + calibration offsets into absolute mm coordinates on the page. */
export function resolvePosition(
  field: FieldPos,
  calibration: DmCalibration
): { leftMm: number; topMm: number; align: "left" | "right" } {
  const baseLeftMm = (field.xPct / 100) * DM_PAGE_WIDTH_MM;
  const baseTopMm = (field.yPct / 100) * DM_PAGE_HEIGHT_MM;
  return {
    leftMm: baseLeftMm + calibration.dmOffsetXMm,
    topMm: baseTopMm + calibration.dmOffsetYMm,
    align: field.align ?? "left",
  };
}
