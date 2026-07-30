import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ProductForm from "@/components/products/ProductForm";
import DeleteProductButton from "@/components/products/DeleteProductButton";
import StatCard from "@/components/dashboard/StatCard";
import RecentInvoicesTable from "@/components/dashboard/RecentInvoicesTable";
import { formatCurrency } from "@/lib/currency";
import { getProductById } from "@/lib/products";
import { getInvoicesByProduct } from "@/lib/invoices";
import { verifySession } from "@/lib/dal";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [currentUser, product] = await Promise.all([verifySession(), getProductById(id)]);

  if (!product) {
    notFound();
  }

  const invoices = await getInvoicesByProduct(id);

  return (
    <div className="flex flex-col gap-6 p-6">
      <Link
        href="/products"
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} />
        Back to Products
      </Link>

      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col gap-4">
          <ProductForm mode="edit" product={product} />
          {currentUser.role === "ADMIN" && (
            <DeleteProductButton productId={product.id} productName={product.name} />
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Times Used" value={String(product.timesUsed)} />
            <StatCard label="Total Revenue" value={formatCurrency(product.totalRevenue)} />
          </div>

          <RecentInvoicesTable
            title="Used In"
            invoices={invoices}
            emptyMessage="This product hasn't been used on any invoices yet."
          />
        </div>
      </div>
    </div>
  );
}
