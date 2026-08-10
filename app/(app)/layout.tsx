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
      {/*
        print:block + print:min-h-0 on both flex wrappers below: a flex
        ancestor with min-h-full stays active during print (min-h-full
        forces a minimum height matching the viewport, which doesn't
        fragment across pages cleanly) and breaks Chromium's print
        pagination — see the matching comment in DotMatrixInvoice.tsx.
      */}
      <div className="flex min-h-full w-full print:block print:min-h-0">
        <div className="print:hidden">
          <AppSidebar role={user.role} />
        </div>
        <div className="flex min-h-full flex-1 flex-col print:block print:min-h-0">
          <div className="print:hidden">
            <AppTopbar user={user} />
          </div>
          <main className="flex flex-1 flex-col bg-background print:block">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
