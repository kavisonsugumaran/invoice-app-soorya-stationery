import Link from "next/link";
import type { getRecentInvoices } from "@/lib/invoices";
import StatusBadge from "@/components/invoices/StatusBadge";
import InitialsAvatar from "@/components/ui/InitialsAvatar";

type InvoiceRow = Awaited<ReturnType<typeof getRecentInvoices>>[number];

type RecentInvoicesTableProps = {
  title?: string;
  invoices: InvoiceRow[];
  viewAllHref?: string;
  emptyMessage?: string;
  hideCustomerColumn?: boolean;
};

export default function RecentInvoicesTable({
  title = "Recent Invoices",
  invoices,
  viewAllHref,
  emptyMessage = "No invoices yet.",
  hideCustomerColumn = false,
}: RecentInvoicesTableProps) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-primary hover:underline"
          >
            View all
          </Link>
        )}
      </div>

      {invoices.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Invoice</th>
              {!hideCustomerColumn && <th className="px-4 py-2 font-medium">Customer</th>}
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2.5 font-medium">
                  <Link href={`/invoices/${invoice.id}`} className="text-foreground hover:text-primary hover:underline">
                    {invoice.invoiceNo}
                  </Link>
                </td>
                {!hideCustomerColumn && (
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {invoice.customer?.name ? (
                      <div className="flex items-center gap-2">
                        <InitialsAvatar name={invoice.customer.name} size={22} />
                        <span>{invoice.customer.name}</span>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className="px-4 py-2.5 text-muted-foreground">
                  {invoice.date.toLocaleDateString("en-CA")}
                </td>
                <td className="px-4 py-2.5 text-right text-foreground">
                  {invoice.total.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
