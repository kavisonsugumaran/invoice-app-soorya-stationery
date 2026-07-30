import CustomerForm from "@/components/customers/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8 sm:px-6">
      <CustomerForm mode="create" />
    </div>
  );
}
