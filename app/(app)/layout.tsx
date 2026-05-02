import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";
import { SupportFab } from "@/components/dashboard/support-fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardProvider>
      <div className="flex min-h-svh">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header />
          <main className="flex-1 px-4 py-4">{children}</main>
        </div>
        <SupportFab />
      </div>
    </DashboardProvider>
  );
}
