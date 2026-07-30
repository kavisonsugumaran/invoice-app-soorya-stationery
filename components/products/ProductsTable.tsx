import Link from "next/link";
import type { getAllProducts } from "@/lib/products";
import { formatCurrency } from "@/lib/currency";
import InitialsAvatar from "@/components/ui/InitialsAvatar";

type ProductRow = Awaited<ReturnType<typeof getAllProducts>>["products"][number];

export default function ProductsTable({
  products,
  emptyMessage = "No products yet.",
}: {
  products: ProductRow[];
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      {products.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2 font-medium">Product</th>
              <th className="px-4 py-2 font-medium">Reference</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-right font-medium">Times Used</th>
              <th className="px-4 py-2 text-right font-medium">Total Revenue</th>
              <th className="px-4 py-2 font-medium">Added</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/products/${product.id}`}
                    className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                  >
                    <InitialsAvatar name={product.name} colorSeed={product.id} shape="square" size={24} />
                    {product.name}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{product.reference}</td>
                <td className="px-4 py-2.5 text-right text-foreground">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-4 py-2.5 text-right text-foreground">{product.timesUsed}</td>
                <td className="px-4 py-2.5 text-right text-foreground">
                  {formatCurrency(product.totalRevenue)}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {product.createdAt.toLocaleDateString("en-CA")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
