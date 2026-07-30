"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

export default function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await logout();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title="Log out"
      aria-label="Log out"
      className="flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
    >
      <LogOut size={16} />
    </button>
  );
}
