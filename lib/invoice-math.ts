export type InvoiceLineInput = {
  price: number;
  quantity: number;
};

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(item: InvoiceLineInput): number {
  return round2(item.price * item.quantity);
}

export function computeInvoiceTotals(
  items: InvoiceLineInput[],
  taxEnabled: boolean,
  taxPercent: number
) {
  const subtotal = round2(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  const taxAmount = round2(taxEnabled ? subtotal * (taxPercent / 100) : 0);
  const total = round2(subtotal + taxAmount);
  return { subtotal, taxAmount, total };
}

/**
 * Splits a decimal rupee amount into whole rupees and a 2-digit cents
 * string, for the small-bill print's split Rs. / Cts. columns (matching the
 * old pre-printed pad's own layout). Pure display formatting on top of an
 * already-rounded amount (round2()/computeLineTotal()/computeInvoiceTotals())
 * — does not re-round or otherwise touch the underlying money math.
 */
export function splitRupeesCents(amount: number): { rupees: number; cents: string } {
  const rounded = round2(Math.abs(amount));
  const rupees = Math.trunc(rounded);
  // 2-digit string, not a number — "05" must render as "05", not "5", to
  // match the pad's fixed-width Cts. column. toFixed on the fractional
  // remainder also sidesteps float remainder artifacts (e.g. 10.10 - 10 =
  // 0.09999999999999964) that a raw subtraction would otherwise leak into
  // the padded string.
  const cents = ((rounded - rupees) * 100).toFixed(0).padStart(2, "0");
  return { rupees, cents };
}
