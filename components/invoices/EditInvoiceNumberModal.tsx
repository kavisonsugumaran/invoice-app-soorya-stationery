"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { updateInvoiceNumber } from "@/app/actions/invoices";
import { useToast } from "@/components/ui/ToastProvider";

export default function EditInvoiceNumberModal({
  invoiceId,
  currentInvoiceNo,
  onClose,
  onSuccess,
}: {
  invoiceId: string;
  currentInvoiceNo: string;
  onClose: () => void;
  onSuccess: (newInvoiceNo: string) => void;
}) {
  const { showToast } = useToast();
  const [invoiceNo, setInvoiceNo] = useState(currentInvoiceNo);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startTransition(async () => {
      const trimmed = invoiceNo.trim();
      const result = await updateInvoiceNumber(invoiceId, trimmed, password);
      if (result.success) {
        showToast("Invoice number updated.");
        onSuccess(trimmed);
      } else {
        showToast(result.error, "error");
        setPassword("");
      }
    });
  }

  return (
    <Modal title="Edit Invoice Number" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Invoice numbers are generated automatically and shouldn&apos;t normally need changing.
          Correcting one here requires an admin password to authorize it.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-muted-foreground" htmlFor="edit-invoice-no">
            Invoice Number
          </label>
          <input
            id="edit-invoice-no"
            type="text"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            maxLength={40}
            autoFocus
            required
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium text-muted-foreground"
            htmlFor="edit-invoice-no-admin-password"
          >
            Admin Password
          </label>
          <input
            id="edit-invoice-no-admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
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
