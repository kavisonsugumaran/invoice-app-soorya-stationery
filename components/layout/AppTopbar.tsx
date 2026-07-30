import Link from "next/link";
import { Search } from "lucide-react";
import type { CurrentUser } from "@/lib/dal";
import LogoutButton from "@/components/layout/LogoutButton";
import Logo from "@/components/ui/Logo";

export default function AppTopbar({ user }: { user: CurrentUser }) {
  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 md:px-6">
      <Link href="/" className="flex items-center gap-2 md:hidden">
        <Logo size={28} />
        <span className="text-sm font-semibold">KadeBill</span>
      </Link>

      <form action="/invoices" method="GET" className="flex-1 max-w-sm">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            name="q"
            placeholder="Search invoices, customers..."
            className="w-full rounded-lg border border-border bg-surface-muted py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </form>

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
