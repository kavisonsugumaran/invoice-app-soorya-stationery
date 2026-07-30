import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CustomerForm from "@/components/customers/CustomerForm";
import DeleteCustomerButton from "@/components/customers/DeleteCustomerButton";
import StatCard from "@/components/dashboard/StatCard";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import { getCustomerById } from "@/lib/customers";
import { getInvoicesByCustomer } from "@/lib/invoices";
import { verifySession } from "@/lib/dal";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [currentUser, customer] = await Promise.all([verifySession(), getCustomerById(id)]);

  if (!customer) {
    notFound();
  }

  const invoices = await getInvoicesByCustomer(id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/customers"
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back to Customers
      </Link>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col gap-4">
          <CustomerForm mode="edit" customer={customer} />
          {currentUser.role === "ADMIN" && (
            <DeleteCustomerButton customerId={customer.id} customerName={customer.name} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Total Invoiced"
              value={customer.totalInvoiced.toFixed(2)}
              hint={`${customer.invoiceCount} invoice${customer.invoiceCount === 1 ? "" : "s"}`}
            />
            <StatCard label="Paid" value={customer.totalPaid.toFixed(2)} tone="success" />
            <StatCard label="Unpaid" value={customer.totalUnpaid.toFixed(2)} tone="warning" />
          </div>

          <RecentInvoicesTable
            title="Invoice History"
            invoices={invoices}
            hideCustomerColumn
            emptyMessage="This customer has no invoices yet."
          />
        </div>
      </div>
    </div>
  );
}
