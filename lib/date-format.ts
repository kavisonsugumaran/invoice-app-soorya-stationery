/** MM/DD/YYYY — the tax invoice date format required by Gazette 2481/22. */
export function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}
