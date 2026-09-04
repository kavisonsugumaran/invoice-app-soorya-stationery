import { Suspense } from "react";
import Link from "next/link";
import type { CurrentUser } from "@/lib/dal";
import LogoutButton from "@/components/layout/LogoutButton";
import Logo from "@/components/ui/Logo";
import TopbarSearch from "@/components/layout/TopbarSearch";

export default function AppTopbar({ user }: { user: CurrentUser }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6">
      <Link href="/" className="flex items-center md:hidden">
        <Logo height={36} />
      </Link>

      <Suspense fallback={<div className="flex-1 max-w-sm" />}>
        <TopbarSearch />
      </Suspense>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">
            {user.role === "ADMIN" ? "Admin" : "Staff"}
          </p>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
