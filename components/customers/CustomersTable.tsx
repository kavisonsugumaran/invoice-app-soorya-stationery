import Link from "next/link";
import type { getAllCustomers } from "@/lib/customers";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import { formatPhone } from "@/lib/phone-format";

type CustomerRow = Awaited<ReturnType<typeof getAllCustomers>>["customers"][number];

export default function CustomersTable({
  customers,
  emptyMessage = "No customers yet.",
}: {
  customers: CustomerRow[];
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      {customers.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Customer</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 text-right font-medium">Invoices</th>
              <th className="px-4 py-2 text-right font-medium">Total Invoiced</th>
              <th className="px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <InitialsAvatar name={customer.name} size={24} />
                    {customer.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{formatPhone(customer.phone) || "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{customer.email ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-foreground">{customer.invoiceCount}</td>
                <td className="px-4 py-2.5 text-right text-foreground">
                  {customer.totalInvoiced.toFixed(2)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {customer.createdAt.toLocaleDateString("en-CA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
