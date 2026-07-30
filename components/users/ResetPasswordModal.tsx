"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { resetUserPassword } from "@/app/actions/users";

export default function ResetPasswordModal({
  userId,
  username,
  onClose,
}: {
  userId: string;
  username: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await resetUserPassword(userId, password);
      if (result.success) {
        setSuccessMessage(`Password reset for ${username}.`);
        setPassword("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Modal title={`Reset Password — ${username}`} onClose={onClose}>
      {successMessage ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-success">{successMessage}</p>
          <button
            type="button"
            onClick={onClose}
            className="self-start rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-muted-foreground" htmlFor="reset-password-input">
              New Temporary Password
            </label>
            <input
              id="reset-password-input"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              autoFocus
              required
              minLength={8}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              At least 8 characters. Share this with the user directly.
            </span>
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Resetting..." : "Reset Password"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
