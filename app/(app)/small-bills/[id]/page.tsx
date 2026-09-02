import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import SmallBillForm from "@/components/small-bill-form/SmallBillForm";
import InvoiceStatusToggle from "@/components/invoices/InvoiceStatusToggle";
import { getInvoiceById } from "@/lib/invoices";
import { getBusinessSettings } from "@/lib/settings";
import { getCustomerDirectory } from "@/lib/customers";
import { getProductDirectory } from "@/lib/products";
import { verifySession } from "@/lib/dal";

export default async function SmallBillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await verifySession();

  // Editing is Admin-only (enforced server-side in updateInvoice too) —
  // send normal users straight to the read-only print view instead of
  // showing them a form they can't submit.
  if (currentUser.role !== "ADMIN") {
    redirect(`/small-bills/${id}/print`);
  }

  const [invoice, business, customers, products] = await Promise.all([
    getInvoiceById(id),
    getBusinessSettings(),
    getCustomerDirectory(),
    getProductDirectory(),
  ]);

  if (!invoice || invoice.billType !== "SMALL") {
    notFound();
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="flex w-full max-w-3xl items-center justify-between">
        <Link
          href="/small-bills"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Small Bills
        </Link>
        <div className="flex items-center gap-4">
          {invoice.createdBy && (
            <span className="text-xs text-muted-foreground">
              Created by {invoice.createdBy.name}
            </span>
          )}
          <Link
            href={`/small-bills/${invoice.id}/print`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Printer size={16} />
            Print / View
          </Link>
          <InvoiceStatusToggle invoiceId={invoice.id} status={invoice.status} variant="full" />
        </div>
      </div>

      <SmallBillForm
        mode="edit"
        invoiceId={invoice.id}
        invoiceNo={invoice.invoiceNo}
        business={business}
        calibration={{
          smallBillOffsetXMm: business?.smallBillOffsetXMm ?? 0,
          smallBillOffsetYMm: business?.smallBillOffsetYMm ?? 0,
        }}
        customers={customers}
        products={products}
        initialData={{
          billToName: invoice.customer?.name ?? "",
          phone: invoice.customer?.phone ?? "",
          address: invoice.customer?.address ?? "",
          taxId: invoice.customer?.taxId ?? "",
          customerId: invoice.customer?.id ?? null,
          date: invoice.date.toISOString().slice(0, 10),
          items: invoice.items.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
        }}
      />
    </div>
  );
}
