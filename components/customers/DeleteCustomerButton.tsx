"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCustomer } from "@/app/actions/customers";

export default function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Delete ${customerName}? Their past invoices are kept but will no longer show a linked customer.`
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteCustomer(customerId);
      if (result.success) {
        router.push("/customers");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-muted disabled:opacity-50"
      >
        <Trash2 size={16} />
        {isPending ? "Deleting..." : "Delete Customer"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
