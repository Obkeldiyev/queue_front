import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { analyticsApi, branchesApi, queuesApi, devicesApi, employeesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  Ticket, Clock, UserX, TrendingUp, GitBranch, ListOrdered, Cpu, Users,
  ArrowRight,
} from "lucide-react";
import { formatDuration } from "@/lib/queue-helpers";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { user, isLoading: authLoading } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const params: Record<string, string> = {};
  if (companyId) params.company_id = companyId;
  if (currentBranchId) params.branch_id = currentBranchId;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-dashboard", companyId, currentBranchId],
    queryFn: () => analyticsApi.dashboard(params).then((r) => r.data),
    enabled: !!companyId,
    refetchInterval: 15_000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: queues = [] } = useQuery({
    queryKey: ["queues", companyId, currentBranchId],
    queryFn: () => queuesApi.list({ company_id: companyId, ...(currentBranchId && { branch_id: currentBranchId }) }).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices-count", companyId],
    queryFn: () => devicesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-count", companyId],
    queryFn: () => employeesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const today = data?.today;
  const hourlyData = (data?.hourly ?? []).map((h) => ({ hour: `${h.hour}h`, tickets: h.count }));

  if (authLoading || (!companyId && !authLoading)) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {user?.first_name ? `Welcome, ${user.first_name}` : "Dashboard"}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live operations overview · refreshes every 15 s
        </p>
      </div>

      {/* Today's ticket stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Waiting",    value: today?.waiting   ?? 0, icon: Clock,       color: "text-amber-600",  bg: "bg-amber-50 dark:bg-amber-950" },
          { label: "Serving",    value: (today?.called ?? 0) + (today?.serving ?? 0), icon: Ticket, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950" },
          { label: "Completed",  value: today?.completed ?? 0, icon: TrendingUp,  color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950" },
          { label: "No-show",    value: today?.noShow    ?? 0, icon: UserX,       color: "text-red-500",    bg: "bg-red-50 dark:bg-red-950" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black">{isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground">{label} today</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Avg wait */}
      {data?.avg_wait_sec != null && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-semibold">Avg wait time today:</span>
            <span className="text-lg font-black text-primary">{formatDuration(data.avg_wait_sec)}</span>
          </CardContent>
        </Card>
      )}

      {/* Resource counts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Branches",  value: branches.length,  icon: GitBranch, to: "/app/branches" },
          { label: "Queues",    value: queues.length,    icon: ListOrdered, to: "/app/queues" },
          { label: "Devices",   value: devices.length,   icon: Cpu,       to: "/app/devices" },
          { label: "Employees", value: employees.length, icon: Users,     to: "/app/employees" },
        ].map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to as any}>
            <Card className="transition hover:border-primary/40 cursor-pointer">
              <CardContent className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xl font-black">{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Hourly chart */}
      {hourlyData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Tickets by hour today</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="tickets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Operator performance table */}
      {(data?.operatorPerformance ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Operator performance</CardTitle>
            <Link to="/app/analytics" className="text-xs text-primary hover:underline flex items-center gap-1">
              Full analytics <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.operatorPerformance!.slice(0, 5).map((op) => (
                <div key={op.operator_id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-sm font-medium">{op.operator_name}</span>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{op.completed_tickets} tickets</span>
                    {op.avg_service_sec && <span>{formatDuration(op.avg_service_sec)} avg</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links for devices */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quick access</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Operator console", to: "/operator", desc: "Call tickets, serve customers", color: "border-blue-200 bg-blue-50 dark:bg-blue-950" },
              { label: "Waiting display",  to: "/display",  desc: "Big screen queue board",       color: "border-indigo-200 bg-indigo-50 dark:bg-indigo-950" },
              { label: "Self-service kiosk", to: "/kiosk", desc: "Customer ticket kiosk",         color: "border-cyan-200 bg-cyan-50 dark:bg-cyan-950" },
            ].map(({ label, to, desc, color }) => (
              <Link key={to} to={to as any}
                className={`rounded-xl border p-4 transition hover:shadow-sm ${color}`}>
                <p className="font-semibold text-sm">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                <Badge variant="outline" className="mt-2 text-[10px] font-mono">{to}</Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

