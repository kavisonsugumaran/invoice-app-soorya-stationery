"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProduct,
  updateProduct,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@/app/actions/products";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

type ExistingProduct = {
  id: string;
  reference: string;
  name: string;
  price: number;
};

type ProductFormProps =
  | { mode: "create" }
  | { mode: "edit"; product: ExistingProduct };

export default function ProductForm(props: ProductFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const initial = props.mode === "edit" ? props.product : null;

  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsConfirmOpen(true);
  }

  function handleConfirm() {
    startTransition(async () => {
      if (props.mode === "create") {
        const input: ProductCreateInput = { name, price };
        const result = await createProduct(input);
        if (result.success) {
          router.push(`/products/${result.id}`);
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      } else {
        const input: ProductUpdateInput = { name, price };
        const result = await updateProduct(props.product.id, input);
        if (result.success) {
          showToast("Changes saved.");
          setIsConfirmOpen(false);
          router.refresh();
        } else {
          setError(result.error);
          setIsConfirmOpen(false);
        }
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <h1 className="text-xl font-semibold text-foreground">
        {props.mode === "create" ? "New Product" : "Product Details"}
      </h1>

      {props.mode === "edit" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted-foreground">Reference</span>
          <span className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted-foreground">
            {props.product.reference}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="product-name">
          Name*
        </label>
        <input
          id="product-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        {props.mode === "edit" && (
          <span className="text-xs text-muted-foreground">
            Renaming updates this product going forward. Invoices that already used it keep
            showing the name/price they were saved with.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="product-price">
          Price*
        </label>
        <input
          id="product-price"
          type="number"
          min="0"
          max="1000000"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.valueAsNumber || 0)}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Saving..." : props.mode === "create" ? "Create Product" : "Save Changes"}
      </button>

      {isConfirmOpen && (
        <ConfirmModal
          title={props.mode === "create" ? "Create Product?" : "Save Changes?"}
          message={
            props.mode === "create"
              ? `Add "${name}" to the product catalog?`
              : "Save these changes? This renames/reprices the product going forward — past invoices that used it are unaffected."
          }
          confirmLabel={isPending ? "Saving..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
