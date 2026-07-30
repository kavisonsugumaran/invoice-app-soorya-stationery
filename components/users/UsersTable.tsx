"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { getAllUsers } from "@/lib/users";
import { setUserActive } from "@/app/actions/users";
import ResetPasswordModal from "@/components/users/ResetPasswordModal";

type UserRow = Awaited<ReturnType<typeof getAllUsers>>[number];

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Username</th>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Joined</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} isSelf={user.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({ user, isSelf }: { user: UserRow; isSelf: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setUserActive(user.id, !user.isActive);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-2.5 font-medium text-foreground">{user.username}</td>
      <td className="px-4 py-2.5 text-muted-foreground">{user.name}</td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {user.role === "ADMIN" ? "Admin" : "Staff"}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            user.isActive ? "bg-success-muted text-success" : "bg-danger-muted text-danger"
          }`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-muted-foreground">
        {user.createdAt.toLocaleDateString("en-CA")}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-xs text-danger">{error}</span>}
          <button
            type="button"
            onClick={() => setIsResetModalOpen(true)}
            disabled={isPending}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
          >
            Reset Password
          </button>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={isPending || isSelf}
            title={isSelf ? "You cannot deactivate your own account" : undefined}
            className={`rounded-md border border-border px-2.5 py-1 text-xs font-medium disabled:opacity-30 ${
              user.isActive
                ? "text-danger hover:bg-danger-muted"
                : "text-success hover:bg-success-muted"
            }`}
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </td>
      {isResetModalOpen && (
        <ResetPasswordModal
          userId={user.id}
          username={user.username}
          onClose={() => setIsResetModalOpen(false)}
        />
      )}
    </tr>
  );
}
