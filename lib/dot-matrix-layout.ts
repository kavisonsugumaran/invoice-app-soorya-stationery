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
// actual reference photo of the stationery (public/pre-printed-invoice-form.jpg,
// rendered as the background in DotMatrixInvoice / DotMatrixCalibrationSheet
// on screen). They still have NOT been calibrated against a real printer —
// the image only validates layout proportions, not printer-specific margin
// drift. Use the Settings page's mm offsets for that once real hardware is
// available.
//
// The Supplier's TIN/Name/Address/E-mail/Telephone/WhatsApp are already
// pre-printed on the stationery (they're the shop's own static details) —
// do NOT print over them. Only the Purchaser side and invoice-specific
// fields are blank on the physical form.
//
// As of the 2026-07 paper revision, the stationery printer stopped
// pre-printing "TAX INVOICE" and the "Tax Invoice No." label on the page —
// that whole area is now a blank box. Both are only meaningful for VAT tax
// invoices, so DotMatrixInvoice only renders taxInvoiceLabel/taxInvoiceNoLabel
// (plus the existing invoiceNo value) when taxEnabled is true; a plain
// non-VAT invoice leaves that area blank, matching the paper.

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

// Header-block fields (everything above the item table) got a small,
// isolated position correction — confirmed via a real printout that the
// item table and totals are correct with the current dmScaleX/dmScaleY/
// offset calibration, but this block still needed to move right and up a
// little on top of that. Since the shared calibration is now proven
// correct elsewhere, this is a base-coordinate fix (like itemsFirstRowYPct
// earlier), not something to chase via calibration again. "Right more"
// fields (tax invoice no, purchaser info, place of supply) got a bigger
// nudge than "right slightly" fields (dates, additional info).
//
// Second polish pass on a follow-up printout: taxInvoiceLabel (the "TAX
// INVOICE" badge) needed the same up+right treatment as the rest of that
// header block, just hadn't been flagged yet. vatPercent/amountInWords/
// modeOfPayment each needed a small upward nudge — small residual drift
// noticed once the bigger issues above were already fixed.
//
// Third pass: the second pass's upward nudge on vatPercent/amountInWords/
// modeOfPayment overshot — a further real printout showed all three now
// sitting too high again. Moved back down (partial revert, not a full
// undo, landing between the first and second pass values) rather than
// guessing a bigger swing blind.
export const DM_LAYOUT = {
  dateOfInvoice: { xPct: 25, yPct: 9.4 } as FieldPos,
  // Only rendered when taxEnabled — the paper no longer pre-prints either of these.
  taxInvoiceLabel: { xPct: 44.5, yPct: 5.9 } as FieldPos,
  taxInvoiceNoLabel: { xPct: 52, yPct: 9.3 } as FieldPos,
  invoiceNo: { xPct: 67, yPct: 9.3 } as FieldPos,

  purchaserTin: { xPct: 67, yPct: 12.8 } as FieldPos,
  purchaserName: { xPct: 67.2, yPct: 14.6 } as FieldPos,
  purchaserAddress: { xPct: 67, yPct: 16.5 } as FieldPos, // wraps onto purchaserAddressLine2 below if long
  purchaserAddressLine2: { xPct: 67, yPct: 18.3 } as FieldPos,
  purchaserPhone: { xPct: 67, yPct: 22.9 } as FieldPos,

  dateOfDelivery: { xPct: 25, yPct: 26.3 } as FieldPos,
  placeOfSupply: { xPct: 67, yPct: 26.3 } as FieldPos,
  additionalInfo: { xPct: 31.5, yPct: 28.3 } as FieldPos,

  // Items table: row Y = itemsFirstRowYPct + (rowIndex * dmItemRowMm converted to %)
  // Was briefly dropped to 39 — measured against the reference photo, the
  // item header bar spans roughly 33.5-37%, leaving almost no clearance at
  // 39 and causing real print rows to overlap the header (confirmed on a
  // real printout). 42 restores a safer margin below the header.
  itemsFirstRowYPct: 42,
  itemsColRef: { xPct: 9, yPct: 0, align: "left" } as FieldPos,
  itemsColDescription: { xPct: 19, yPct: 0, align: "left" } as FieldPos,
  itemsColQty: { xPct: 65, yPct: 0, align: "right" } as FieldPos,
  itemsColUnitPrice: { xPct: 75, yPct: 0, align: "right" } as FieldPos,
  itemsColAmount: { xPct: 91, yPct: 0, align: "right" } as FieldPos,

  totalValueOfSupply: { xPct: 91, yPct: 75.5, align: "right" } as FieldPos,
  // Fills the blank inside "...@   )" — the paper does NOT pre-print a "%"
  // there (confirmed on a real printout), so DotMatrixInvoice appends it
  // to the rendered value itself.
  vatPercent: { xPct: 35, yPct: 78.4 } as FieldPos,
  vatAmount: { xPct: 91, yPct: 78.8, align: "right" } as FieldPos,
  totalIncludingVat: { xPct: 91, yPct: 82.0, align: "right" } as FieldPos,

  amountInWords: { xPct: 28, yPct: 85.0 } as FieldPos,
  modeOfPayment: { xPct: 28, yPct: 88.0 } as FieldPos,

  // Bottom boundary for item rows — just above the "Total Value of Supply"
  // row's border (that row's text sits at yPct 75.5), leaving a small buffer
  // for row height/descenders. Once a page's rows would cross this line, the
  // rest of the items overflow onto an additional physical page instead.
  itemsAreaEndYPct: 73,
} as const;

export type DmCalibration = {
  dmOffsetXMm: number;
  dmOffsetYMm: number;
  dmFontSizePt: number;
  dmItemRowMm: number;
  /** Multiplies Y position from the top of the page, before dmOffsetYMm — corrects a printer/driver that compresses or stretches the page proportionally, which a flat offset can't. 1 = no change. */
  dmScaleY: number;
  /** Same as dmScaleY, applied to X position from the left edge, before dmOffsetXMm. 1 = no change. */
  dmScaleX: number;
};

/** Returns the field position for a given item table row, based on the configured row height. */
export function itemRowFieldPos(col: FieldPos, rowIndex: number, itemRowMm: number): FieldPos {
  const rowOffsetPct = ((rowIndex * itemRowMm) / DM_PAGE_HEIGHT_MM) * 100;
  return { ...col, yPct: DM_LAYOUT.itemsFirstRowYPct + rowOffsetPct };
}

/** How many item rows fit on one physical page before hitting the totals box, given the business's configured row height. */
export function maxItemsPerPage(itemRowMm: number): number {
  const rowPct = (itemRowMm / DM_PAGE_HEIGHT_MM) * 100;
  const availablePct = DM_LAYOUT.itemsAreaEndYPct - DM_LAYOUT.itemsFirstRowYPct;
  return Math.max(1, Math.floor(availablePct / rowPct) + 1);
}

/** Splits items into pages of at most maxItemsPerPage(itemRowMm), always returning at least one (possibly empty) page. */
export function paginateItems<T>(items: T[], itemRowMm: number): T[][] {
  const perPage = maxItemsPerPage(itemRowMm);
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

/** Converts a layout field position + calibration offsets into absolute mm coordinates on the page. */
export function resolvePosition(
  field: FieldPos,
  calibration: DmCalibration
): { leftMm: number; topMm: number; align: "left" | "right" } {
  const baseLeftMm = (field.xPct / 100) * DM_PAGE_WIDTH_MM;
  const baseTopMm = (field.yPct / 100) * DM_PAGE_HEIGHT_MM;
  return {
    leftMm: baseLeftMm * calibration.dmScaleX + calibration.dmOffsetXMm,
    topMm: baseTopMm * calibration.dmScaleY + calibration.dmOffsetYMm,
    align: field.align ?? "left",
  };
}
