"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { cancelInvoice } from "@/app/actions/invoices";
import { useToast } from "@/components/ui/ToastProvider";

export default function CancelInvoiceModal({
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
      const result = await cancelInvoice(invoiceId, password);
      if (result.success) {
        showToast("Invoice cancelled.");
        onSuccess();
      } else {
        showToast(result.error, "error");
        setPassword("");
      }
    });
  }

  return (
    <Modal title="Cancel Invoice?" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          This voids the invoice — it stays in the system marked as Cancelled and no longer
          counts toward revenue or outstanding totals. This can&apos;t be undone. Enter an
          admin password to authorize it.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground" htmlFor="cancel-admin-password">
            Admin Password
          </label>
          <input
            id="cancel-admin-password"
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
            {isPending ? "Verifying..." : "Cancel Invoice"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            Keep Invoice
          </button>
        </div>
      </form>
    </Modal>
  );
}
