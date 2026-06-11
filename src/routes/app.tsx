import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard, Building2, GitBranch, Layers, ListOrdered, Monitor, Users,
  Cpu, Menu as MenuIcon, FileText, Ticket, BarChart3, ShieldCheck, Settings,
  Bell, RefreshCcw, ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/companies", label: "Companies", icon: Building2 },
  { to: "/app/branches", label: "Branches", icon: GitBranch },
  { to: "/app/services", label: "Services", icon: Layers },
  { to: "/app/queues", label: "Queue Designer", icon: ListOrdered },
  { to: "/app/counters", label: "Counters", icon: Monitor },
  { to: "/app/employees", label: "Employees", icon: Users },
  { to: "/app/devices", label: "Devices", icon: Cpu },
  { to: "/app/menus", label: "Menu Builder", icon: MenuIcon },
  { to: "/app/pages", label: "Page Builder", icon: FileText },
  { to: "/app/tickets", label: "Ticket Templates", icon: Ticket },
  { to: "/app/orders", label: "Online Orders", icon: ShoppingBag },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/audit", label: "Audit Log", icon: ShieldCheck },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { companies, branches, currentCompanyId, currentBranchId, setCurrentCompany, setCurrentBranch, notifications, markAllRead, seed, reset } = useStore();
  const unread = notifications.filter((n) => !n.read).length;
  const company = companies.find((c) => c.id === currentCompanyId);
  const companyBranches = branches.filter((b) => b.companyId === currentCompanyId);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">Q</div>
            Qubit
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to as "/app"}
                className={`mb-0.5 flex items-center gap-2 rounded-md px-3 py-2 transition ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
              >
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/60">
          <div className="mb-2 flex gap-2">
            <Link to="/operator" className="flex-1 rounded-md bg-sidebar-accent px-2 py-1.5 text-center">Operator</Link>
            <Link to="/display" className="flex-1 rounded-md bg-sidebar-accent px-2 py-1.5 text-center">Display</Link>
            <Link to="/kiosk" className="flex-1 rounded-md bg-sidebar-accent px-2 py-1.5 text-center">Kiosk</Link>
          </div>
          <div>v1.0 · Demo build</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
          <div className="flex items-center gap-2">
            <Select value={currentCompanyId} onValueChange={setCurrentCompany}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={currentBranchId} onValueChange={setCurrentBranch}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{companyBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => { reset(); seed(); }} title="Reset demo data"><RefreshCcw className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={markAllRead} className="relative">
              <Bell className="h-4 w-4" />
              {unread > 0 && <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[10px]">{unread}</Badge>}
            </Button>
            <div className="hidden text-right text-xs text-muted-foreground md:block">
              <div>{company?.name ?? "—"}</div>
              <div>Super Admin</div>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  );
}
