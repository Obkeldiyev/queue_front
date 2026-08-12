import { createFileRoute, Link, Outlet, useRouterState, redirect, useNavigate } from "@tanstack/react-router";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore, getUserFromStorage } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { isCompanyAdminRole } from "@/lib/guards";
import { useLang, LANGS, loc } from "@/lib/i18n";
import { branchesApi, companiesApi } from "@/lib/api";
import {
  LayoutDashboard, Building2, GitBranch, Layers, ListOrdered, Monitor, Users,
  Cpu, Menu as MenuIcon, FileText, Ticket, BarChart3, ShieldCheck, Settings,
  Bell, LogOut, ChevronDown, Tv2, KeyboardIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

export const Route = createFileRoute("/app")({
  // Guard: only authenticated company users can access /app
  // Platform users (super admin) are redirected to /app/companies
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    const user = getUserFromStorage();
    const token = localStorage.getItem("qms_access_token");
    const refresh = localStorage.getItem("qms_refresh_token");
    if ((!token && !refresh) || !user) throw redirect({ to: "/login" as any });
    if (user?.type === "platform_user" && pathname !== "/app/companies") {
      throw redirect({ to: "/app/companies" as any });
    }
    if (user?.type === "company_user" && !isCompanyAdminRole(user)) throw redirect({ to: "/operator" as any });
  },
  component: AppLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  extraLabel?: string;
};

const ADMIN_NAV: NavItem[] = [
  { to: "/app",               label: "dashboard",     icon: LayoutDashboard, exact: true },
  { to: "/app/branches",      label: "branches",      icon: GitBranch },
  { to: "/app/services",      label: "services",      icon: Layers },
  { to: "/app/queues",        label: "queueDesigner", icon: ListOrdered },
  { to: "/app/counters",      label: "counters",      icon: Monitor },
  { to: "/app/employees",     label: "employees",     icon: Users },
  { to: "/app/devices",       label: "devices",       icon: Cpu },
  { to: "/app/menus",         label: "menuBuilder",   icon: MenuIcon },
  { to: "/app/analytics",     label: "analytics",     icon: BarChart3 },
  { to: "/app/audit",         label: "auditLog",      icon: ShieldCheck },
  { to: "/app/kioskEditor",   label: "settings",      icon: Settings, extraLabel: "Kiosk Editor" },
];

function roleBadge(user: ReturnType<typeof getUserFromStorage>, t: (key: any) => string): string {
  if (!user) return "";
  if (user.type === "platform_user") return t("superAdminRole");
  const roleTypes = user.roleTypes ?? [];
  if (roleTypes.includes("COMPANY_ADMIN")) return t("companyAdmin");
  if (roleTypes.includes("BRANCH_MANAGER")) return t("manager");
  if (roleTypes.includes("SUPERVISOR")) return "Supervisor";
  if (roleTypes.includes("OPERATOR")) return t("operator");
  return t("viewer");
}

function AppLayout() {
  const { user, logout } = useAuthStore();
  const { currentCompanyId, currentBranchId, setCurrentCompany, setCurrentBranch } = useStore();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (user?.type === "platform_user") {
    return <Outlet />;
  }

  const companyId = user?.company_id ?? currentCompanyId ?? "";

  // Load real branches for the company
  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  // Load company info
  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => companiesApi.get(companyId).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const handleLogout = async () => {
    await logout();
    void navigate({ to: "/login" as any });
  };

  const branchId = currentBranchId || branches[0]?.id || "";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">

      {/* ── Sidebar ── */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground font-black text-sm">Q</div>
          <div>
            <div className="text-sm font-bold leading-none">Qubit QMS</div>
            <div className="text-[10px] text-sidebar-foreground/50 mt-0.5 truncate max-w-[130px]">
              {company?.name ?? "Loading…"}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 text-sm">
          {ADMIN_NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const label = n.extraLabel ?? t(n.label as Parameters<typeof t>[0]);
            return (
              <Link
                key={n.to}
                to={n.to as any}
                className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2 transition ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Device quick-links */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          <p className="px-1 text-[10px] uppercase tracking-widest text-sidebar-foreground/40 mb-1.5">Devices</p>
          <div className="grid grid-cols-3 gap-1">
            {[
              { to: "/operator", label: "Operator", icon: KeyboardIcon },
              { to: "/display",  label: "Display",  icon: Tv2 },
              { to: "/kiosk",    label: "Kiosk",    icon: Ticket },
            ].map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to as any}
                className="flex flex-col items-center gap-1 rounded-lg p-2 text-[10px] text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">

          {/* Branch selector */}
          <Select value={branchId} onValueChange={setCurrentBranch}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder={t("branches")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}
                </SelectItem>
              ))}
              {branches.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No branches yet</div>
              )}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex gap-0.5 rounded-lg border p-0.5">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded px-2 py-1 text-xs font-medium transition ${
                    lang === l.code
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-9">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {user?.first_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="hidden md:block text-sm">
                    {user?.first_name} {user?.last_name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <Badge variant="outline" className="mt-1 text-[10px]">{roleBadge(user, t)}</Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={"/app/settings" as any} className="flex items-center gap-2">
                    <Settings className="h-4 w-4" /> {t("settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleLogout()}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
