import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { PageStateProvider } from "@/lib/page-state";
import { SupportFab } from "@/components/dashboard/support-fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageStateProvider>
      <DashboardProvider>
        <div className="flex min-h-svh">
          <Sidebar />
          <div className="flex-1 min-w-0 flex flex-col">
            <Header />
            <main
              data-export-root
              className="flex-1 px-3 sm:px-4 py-3 sm:py-4 min-w-0"
            >
              {children}
            </main>
          </div>
          <SupportFab />
        </div>
      </DashboardProvider>
    </PageStateProvider>
  );
}
