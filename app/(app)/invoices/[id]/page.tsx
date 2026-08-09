import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import InvoiceForm from "@/components/invoice-form/InvoiceForm";
import InvoiceStatusToggle from "@/components/invoices/InvoiceStatusToggle";
import { getInvoiceById } from "@/lib/invoices";
import { getBusinessSettings } from "@/lib/settings";
import { getCustomerDirectory } from "@/lib/customers";
import { getProductDirectory } from "@/lib/products";
import { verifySession } from "@/lib/dal";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await verifySession();

  // Editing an existing invoice is Admin-only (enforced server-side in
  // updateInvoice too) — send normal users straight to the read-only print
  // view instead of showing them a form they can't submit.
  if (currentUser.role !== "ADMIN") {
    redirect(`/invoices/${id}/print`);
  }

  const [invoice, business, customers, products] = await Promise.all([
    getInvoiceById(id),
    getBusinessSettings(),
    getCustomerDirectory(),
    getProductDirectory(),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="flex w-full max-w-4xl items-center justify-between">
        <Link
          href="/invoices"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to Invoices
        </Link>
        <div className="flex items-center gap-4">
          {invoice.createdBy && (
            <span className="text-xs text-muted-foreground">
              Created by {invoice.createdBy.name}
            </span>
          )}
          <Link
            href={`/invoices/${invoice.id}/print`}
            className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Printer size={16} />
            Print / View
          </Link>
          <InvoiceStatusToggle invoiceId={invoice.id} status={invoice.status} variant="full" />
        </div>
      </div>

      <InvoiceForm
        mode="edit"
        invoiceId={invoice.id}
        invoiceNo={invoice.invoiceNo}
        business={business}
        customers={customers}
        products={products}
        initialData={{
          billTo: {
            name: invoice.customer?.name ?? "",
            phone: invoice.customer?.phone ?? "",
            address: invoice.customer?.address ?? "",
            taxId: invoice.customer?.taxId ?? "",
            customerId: invoice.customer?.id ?? null,
          },
          date: invoice.date.toISOString().slice(0, 10),
          dateOfDelivery: invoice.dateOfDelivery
            ? invoice.dateOfDelivery.toISOString().slice(0, 10)
            : "",
          placeOfSupply: invoice.placeOfSupply ?? "",
          modeOfPayment: invoice.modeOfPayment ?? "",
          additionalInfo: invoice.additionalInfo ?? "",
          taxEnabled: invoice.taxEnabled,
          taxPercent: invoice.taxPercent,
          items: invoice.items.map((item) => ({
            reference: item.reference ?? "",
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            productId: item.productId ?? undefined,
          })),
        }}
      />
    </div>
  );
}
