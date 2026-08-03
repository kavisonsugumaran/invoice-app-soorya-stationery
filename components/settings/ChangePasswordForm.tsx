"use client";

import { useState, useTransition } from "react";
import { changeOwnPassword } from "@/app/actions/users";

export default function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await changeOwnPassword({ currentPassword, newPassword });
      if (result.success) {
        setSuccessMessage("Password changed.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <div>
        <h1 className="text-xl font-semibold text-foreground">Change Password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the password you use to sign in.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="change-password-current">
          Current Password
        </label>
        <input
          id="change-password-current"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="change-password-new">
          New Password
        </label>
        <input
          id="change-password-new"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">At least 8 characters.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="change-password-confirm">
          Confirm New Password
        </label>
        <input
          id="change-password-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {successMessage && (
        <p role="status" className="text-sm text-success">
          {successMessage}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Changing..." : "Change Password"}
        </button>
      </div>
    </form>
  );
}
