import AppSidebar from "@/components/layout/AppSidebar";
import AppTopbar from "@/components/layout/AppTopbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { verifySession } from "@/lib/dal";

export default async function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await verifySession();

  return (
    <ToastProvider>
      <div className="flex min-h-full w-full">
        <div className="print:hidden">
          <AppSidebar role={user.role} />
        </div>
        <div className="flex min-h-full flex-1 flex-col">
          <div className="print:hidden">
            <AppTopbar user={user} />
          </div>
          <main className="flex flex-1 flex-col bg-background print:block">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
