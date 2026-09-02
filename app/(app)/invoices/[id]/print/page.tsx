import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import InvoicePreviewPanel from "@/components/invoices/InvoicePreviewPanel";
import InvoiceStatusToggle from "@/components/invoices/InvoiceStatusToggle";
import EditInvoiceNumberControl from "@/components/invoices/EditInvoiceNumberControl";
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

  if (!invoice || invoice.billType !== "COMMERCIAL") {
    notFound();
  }

  const isAdmin = currentUser.role === "ADMIN";

  return (
    // Plain block layout (space-y-6, not flex flex-col items-center) — a flex
    // ancestor above the multi-page print content breaks Chromium's print
    // pagination (see the comment in DotMatrixInvoice.tsx). Centering moves
    // to mx-auto on the fixed-width children instead.
    <div className="space-y-6 p-6 print:p-0">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between print:hidden">
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
          <EditInvoiceNumberControl invoiceId={invoice.id} invoiceNo={invoice.invoiceNo} />
          <InvoiceStatusToggle
            invoiceId={invoice.id}
            status={invoice.status}
            variant="full"
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl print:max-w-none">
        <InvoicePreviewPanel
          business={business}
          calibration={{
            dmOffsetXMm: business?.dmOffsetXMm ?? 0,
            dmOffsetYMm: business?.dmOffsetYMm ?? 0,
            dmFontSizePt: business?.dmFontSizePt ?? 10,
            dmItemRowMm: business?.dmItemRowMm ?? 6,
            dmScaleY: business?.dmScaleY ?? 1,
            dmScaleX: business?.dmScaleX ?? 1,
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
