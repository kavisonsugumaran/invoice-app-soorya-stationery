"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Users,
  Package,
  Settings,
  UserCog,
} from "lucide-react";
import Logo from "@/components/ui/Logo";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/invoices", label: "Invoices", icon: FileText, adminOnly: false },
  { href: "/customers", label: "Customers", icon: Users, adminOnly: false },
  { href: "/products", label: "Products", icon: Package, adminOnly: false },
  { href: "/users", label: "Users", icon: UserCog, adminOnly: true },
  { href: "/settings", label: "Settings", icon: Settings, adminOnly: false },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppSidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || role === "ADMIN");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <Logo size={32} />
        <span className="text-base font-semibold">KadeBill</span>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/invoices/new"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <FilePlus2 size={16} />
          New Invoice
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-sidebar-active text-sidebar-active-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} KadeBill
      </div>
    </aside>
  );
}
