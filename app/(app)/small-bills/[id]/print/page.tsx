import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import SmallBillPrint from "@/components/small-bill-print/SmallBillPrint";
import InvoiceStatusToggle from "@/components/invoices/InvoiceStatusToggle";
import { getInvoiceById } from "@/lib/invoices";
import { getBusinessSettings } from "@/lib/settings";
import { verifySession } from "@/lib/dal";

export default async function SmallBillPrintPage({
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

  if (!invoice || invoice.billType !== "SMALL") {
    notFound();
  }

  const isAdmin = currentUser.role === "ADMIN";

  return (
    // Plain block layout — same Chromium print-pagination safety reasoning
    // as the commercial invoice print page.
    <div className="space-y-6 p-6 print:p-0">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between print:hidden">
        <Link
          href={isAdmin ? `/small-bills/${invoice.id}` : "/small-bills"}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          {isAdmin ? "Back to Small Bill" : "Back to Small Bills"}
        </Link>
        <div className="flex items-center gap-4">
          {invoice.createdBy && (
            <span className="text-xs text-muted-foreground">
              Created by {invoice.createdBy.name}
            </span>
          )}
          <InvoiceStatusToggle invoiceId={invoice.id} status={invoice.status} variant="full" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl print:max-w-none">
        <SmallBillPrint
          business={business}
          calibration={{
            smallBillOffsetXMm: business?.smallBillOffsetXMm ?? 0,
            smallBillOffsetYMm: business?.smallBillOffsetYMm ?? 0,
          }}
          invoiceNo={invoice.invoiceNo}
          date={invoice.date}
          billToName={invoice.customer?.name ?? ""}
          items={invoice.items.map((item) => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          }))}
        />
      </div>
    </div>
  );
}
