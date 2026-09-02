import SmallBillForm from "@/components/small-bill-form/SmallBillForm";
import { getBusinessSettings } from "@/lib/settings";
import { getCustomerDirectory } from "@/lib/customers";
import { getProductDirectory } from "@/lib/products";

export default async function NewSmallBillPage() {
  const [business, customers, products] = await Promise.all([
    getBusinessSettings(),
    getCustomerDirectory(),
    getProductDirectory(),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
      <SmallBillForm
        business={business}
        calibration={{
          smallBillOffsetXMm: business?.smallBillOffsetXMm ?? 0,
          smallBillOffsetYMm: business?.smallBillOffsetYMm ?? 0,
        }}
        customers={customers}
        products={products}
      />
    </div>
  );
}
