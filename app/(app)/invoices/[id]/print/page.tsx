import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import InvoicePreviewPanel from "@/components/invoices/InvoicePreviewPanel";
import InvoiceStatusToggle from "@/components/invoices/InvoiceStatusToggle";
import { getInvoiceById } from "@/lib/invoices";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [currentUser, invoice, business] = await Promise.all([
    verifySession(),
    getInvoiceById(id),
    getBusinessSettings(),
  ]);

  if (!invoice) {
    notFound();
  }

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="flex w-full max-w-3xl items-center justify-between print:hidden">
        <Link
          href={isAdmin ? `/invoices/${invoice.id}` : "/invoices"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {isAdmin ? "Back to Invoice" : "Back to Invoices"}
        </Link>
        <div className="flex items-center gap-4">
          {invoice.createdBy && (
            <span className="text-xs text-muted-foreground">
              Created by {invoice.createdBy.name}
            </span>
          )}
          <InvoiceStatusToggle
            invoiceId={invoice.id}
            status={invoice.status}
            variant="full"
          />
        </div>
      </div>

      <div className="w-full max-w-3xl">
        <InvoicePreviewPanel
          business={business}
          calibration={{
            dmOffsetXMm: business?.dmOffsetXMm ?? 0,
            dmOffsetYMm: business?.dmOffsetYMm ?? 0,
            dmFontSizePt: business?.dmFontSizePt ?? 10,
            dmItemRowMm: business?.dmItemRowMm ?? 6,
          }}
          invoiceNo={invoice.invoiceNo}
          date={invoice.date}
          dateOfDelivery={invoice.dateOfDelivery}
          placeOfSupply={invoice.placeOfSupply}
          modeOfPayment={invoice.modeOfPayment}
          additionalInfo={invoice.additionalInfo}
          billTo={{
            name: invoice.customer?.name ?? "",
            phone: invoice.customer?.phone ?? "",
            address: invoice.customer?.address ?? "",
            taxId: invoice.customer?.taxId ?? "",
          }}
          items={invoice.items.map((item) => ({
            reference: item.reference ?? "",
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          }))}
          taxEnabled={invoice.taxEnabled}
          taxPercent={invoice.taxPercent}
          subtotal={invoice.subtotal}
          taxAmount={invoice.taxAmount}
          total={invoice.total}
        />
      </div>
    </div>
  );
}
