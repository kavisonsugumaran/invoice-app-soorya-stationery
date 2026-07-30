import InvoiceForm from "@/components/invoice-form/InvoiceForm";
import { getBusinessSettings } from "@/lib/settings";
import { getCustomerDirectory } from "@/lib/customers";
import { getProductDirectory } from "@/lib/products";

export default async function NewInvoicePage() {
  const [business, customers, products] = await Promise.all([
    getBusinessSettings(),
    getCustomerDirectory(),
    getProductDirectory(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
      <InvoiceForm business={business} customers={customers} products={products} />
    </div>
  );
}
