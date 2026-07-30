import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export function DashboardShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email?: string | null;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header email={email} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
