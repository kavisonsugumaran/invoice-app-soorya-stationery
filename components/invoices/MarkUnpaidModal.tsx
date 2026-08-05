"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { revertInvoiceToUnpaid } from "@/app/actions/invoices";
import { useToast } from "@/components/ui/ToastProvider";

export default function MarkUnpaidModal({
  invoiceId,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const result = await revertInvoiceToUnpaid(invoiceId, password);
      if (result.success) {
        showToast("Invoice marked as unpaid.");
        onSuccess();
      } else {
        showToast(result.error, "error");
        setPassword("");
      }
    });
  }

  return (
    <Modal title="Mark as Unpaid?" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This reverses a paid invoice back to unpaid. Enter your admin password to confirm.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground" htmlFor="unpaid-admin-password">
            Admin Password
          </label>
          <input
            id="unpaid-admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Verifying..." : "Mark as Unpaid"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
