import { useLang } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { analyticsApi, branchesApi, queuesApi, devicesApi, employeesApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Ticket,
  Clock,
  UserX,
  TrendingUp,
  GitBranch,
  ListOrdered,
  Cpu,
  Users,
  ArrowRight,
} from "lucide-react";
import { formatDuration } from "@/lib/queue-helpers";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
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
    queryFn: () =>
      queuesApi
        .list({ company_id: companyId, ...(currentBranchId && { branch_id: currentBranchId }) })
        .then((r) => r.data),
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
      <section className="rounded-2xl border bg-gradient-to-br from-blue-50 to-white p-5 dark:from-slate-900 dark:to-slate-950">
        <h2 className="text-lg font-bold">
          {L("Set up your branch", "Настройте филиал", "Filialni sozlang")}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {L(
            "Follow these steps in order. Each step builds on the previous one.",
            "Выполните шаги по порядку. Каждый следующий использует предыдущий.",
            "Bosqichlarni ketma-ket bajaring.",
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              to: "/app/branches",
              title: L("1. Branch", "1. Филиал", "1. Filial"),
              done: branches.length > 0,
            },
            {
              to: "/app/services",
              title: L("2. Services & queues", "2. Услуги и очереди", "2. Xizmat va navbat"),
              done: queues.length > 0,
            },
            {
              to: "/app/counters",
              title: L("3. Counters & staff", "3. Окна и сотрудники", "3. Oynalar va xodimlar"),
              done: employees.length > 0,
            },
            {
              to: "/app/devices",
              title: L("4. Devices & design", "4. Устройства и дизайн", "4. Qurilma va dizayn"),
              done: devices.length > 0,
            },
            {
              to: "/app/audit",
              title: L("5. Rules & KPI", "5. Правила и KPI", "5. Qoidalar va KPI"),
              done: false,
            },
          ].map((step) => (
            <Link
              key={step.to}
              to={step.to as any}
              className="rounded-xl border bg-card p-3 text-sm font-medium transition hover:border-primary"
            >
              {step.done ? "✓" : "→"} {step.title}
            </Link>
          ))}
        </div>
      </section>
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold">
          {user?.first_name ? L(`Welcome, ${user.first_name}`, `Добро пожаловать, ${user.first_name}`, `Xush kelibsiz, ${user.first_name}`) : L("Dashboard", "Панель", "Boshqaruv paneli")}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {L("Live operations overview · refreshes every 15 s", "Обзор операций · обновляется каждые 15 сек", "Amaliyotlar ko‘rinishi · har 15 soniyada yangilanadi")}
        </p>
      </div>

      {/* Today's ticket stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: L("Waiting", "Ожидают", "Kutmoqda"),
            value: today?.waiting ?? 0,
            icon: Clock,
            color: "text-amber-600",
            bg: "bg-amber-50 dark:bg-amber-950",
          },
          {
            label: L("Serving", "Обслуживаются", "Xizmatda"),
            value: (today?.called ?? 0) + (today?.serving ?? 0),
            icon: Ticket,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-950",
          },
          {
            label: L("Completed", "Завершены", "Yakunlangan"),
            value: today?.completed ?? 0,
            icon: TrendingUp,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-950",
          },
          {
            label: L("No-show", "Не явились", "Kelmagan"),
            value: today?.noShow ?? 0,
            icon: UserX,
            color: "text-red-500",
            bg: "bg-red-50 dark:bg-red-950",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black">{isLoading ? "—" : value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
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
            <span className="font-semibold">{L("Avg wait time today:", "Среднее ожидание сегодня:", "Bugungi o‘rtacha kutish vaqti:")}</span>
            <span className="text-lg font-black text-primary">
              {formatDuration(data.avg_wait_sec)}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Resource counts */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: L("Branches", "Филиалы", "Filiallar"), value: branches.length, icon: GitBranch, to: "/app/branches" },
          { label: L("Queues", "Очереди", "Navbatlar"), value: queues.length, icon: ListOrdered, to: "/app/queues" },
          { label: L("Devices", "Устройства", "Qurilmalar"), value: devices.length, icon: Cpu, to: "/app/devices" },
          { label: L("Employees", "Сотрудники", "Xodimlar"), value: employees.length, icon: Users, to: "/app/employees" },
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
          <CardHeader>
            <CardTitle className="text-base">{L("Tickets by hour today", "Талоны по часам сегодня", "Bugungi chiptalar soatlar bo‘yicha")}</CardTitle>
          </CardHeader>
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
            <CardTitle className="text-base">{L("Operator performance", "Эффективность операторов", "Operatorlar samaradorligi")}</CardTitle>
            <Link
              to="/app/analytics"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {L("Full analytics", "Полная аналитика", "To‘liq analitika")} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.operatorPerformance!.slice(0, 5).map((op) => (
                <div
                  key={op.operator_id}
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
                >
                  <span className="text-sm font-medium">{op.operator_name}</span>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{op.completed_tickets} {L("tickets", "талонов", "chipta")}</span>
                    {op.avg_service_sec && <span>{formatDuration(op.avg_service_sec)} {L("avg", "сред.", "o‘rt.")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick links for devices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{L("Quick access", "Быстрый доступ", "Tez kirish")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: L("Operator console", "Панель оператора", "Operator paneli"),
                to: "/operator",
                desc: L("Call tickets, serve customers", "Вызывать талоны и обслуживать клиентов", "Chiptalarni chaqirish va mijozlarga xizmat ko‘rsatish"),
                color: "border-blue-200 bg-blue-50 dark:bg-blue-950",
              },
              {
                label: L("Waiting display", "Экран ожидания", "Kutish ekrani"),
                to: "/display",
                desc: L("Big screen queue board", "Большой экран очереди", "Katta navbat ekrani"),
                color: "border-indigo-200 bg-indigo-50 dark:bg-indigo-950",
              },
              {
                label: L("Self-service kiosk", "Киоск самообслуживания", "O‘z-o‘ziga xizmat kioski"),
                to: "/kiosk",
                desc: L("Customer ticket kiosk", "Киоск выдачи талонов", "Mijozlar chipta kioski"),
                color: "border-cyan-200 bg-cyan-50 dark:bg-cyan-950",
              },
            ].map(({ label, to, desc, color }) => (
              <Link
                key={to}
                to={to as any}
                className={`rounded-xl border p-4 transition hover:shadow-sm ${color}`}
              >
                <p className="font-semibold text-sm">{label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                <Badge variant="outline" className="mt-2 text-[10px] font-mono">
                  {to}
                </Badge>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
