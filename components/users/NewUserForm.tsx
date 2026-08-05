"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { createUser } from "@/app/actions/users";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";

export default function NewUserForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
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
      const result = await createUser({ username, name, password, role });
      if (result.success) {
        showToast(`User "${username}" created.`);
        setUsername("");
        setName("");
        setPassword("");
        setRole("USER");
        router.refresh();
      } else {
        setError(result.error);
      }
      setIsConfirmOpen(false);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-foreground">New User</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-username">
          Username*
        </label>
        <input
          id="new-user-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-name">
          Name*
        </label>
        <input
          id="new-user-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-password">
          Temporary Password*
        </label>
        <input
          id="new-user-password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          required
          minLength={8}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">At least 8 characters. Share this with the user directly.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground" htmlFor="new-user-role">
          Role
        </label>
        <select
          id="new-user-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        >
          <option value="USER">Staff (User)</option>
          <option value="ADMIN">Admin</option>
        </select>
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
        {isPending ? "Creating..." : "Create User"}
      </button>

      {isConfirmOpen && (
        <ConfirmModal
          title="Create User?"
          message={`Create a new ${role === "ADMIN" ? "Admin" : "Staff"} account for "${username}"?`}
          confirmLabel={isPending ? "Creating..." : "Confirm"}
          isPending={isPending}
          onConfirm={handleConfirm}
          onCancel={() => setIsConfirmOpen(false)}
        />
      )}
    </form>
  );
}
