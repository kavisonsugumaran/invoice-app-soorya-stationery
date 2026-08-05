"use client";

import Modal from "@/components/ui/Modal";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "success",
  isPending = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "success" | "danger";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={`rounded-full px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 ${
              tone === "danger" ? "bg-danger" : "bg-success"
            }`}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
