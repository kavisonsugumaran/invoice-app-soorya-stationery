import ProductForm from "@/components/products/ProductForm";

export default function NewProductPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
      <ProductForm mode="create" />
    </div>
  );
}
