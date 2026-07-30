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
