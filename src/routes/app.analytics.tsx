import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { analyticsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Ticket, Clock, UserX, TrendingUp } from "lucide-react";
import { formatDuration } from "@/lib/queue-helpers";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/app/analytics")({
  beforeLoad: requireCompanyAdmin,
  component: Analytics,
});

const COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981"];

function Analytics() {
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const { user } = useAuthStore();
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

  const today = data?.today;
  const total = today
    ? today.waiting + today.called + today.serving + today.completed + today.noShow
    : 0;

  const hourlyData = (data?.hourly ?? []).map((h) => ({
    hour: `${h.hour}:00`,
    tickets: h.count,
  }));

  const sourceData = [
    { name: L("Kiosk", "Киоск", "Kiosk"),  value: today?.kiosk  ?? 0 },
    { name: L("Online", "Онлайн", "Onlayn"), value: today?.online ?? 0 },
  ].filter((d) => d.value > 0);

  const statusCards = [
    { label: L("Total today", "Всего сегодня", "Bugun jami"),  value: total,               icon: Ticket,    color: "text-primary" },
    { label: L("Completed", "Завершены", "Yakunlangan"),    value: today?.completed ?? 0, icon: TrendingUp, color: "text-green-600" },
    { label: L("No-show", "Не явились", "Kelmagan"),      value: today?.noShow    ?? 0, icon: UserX,     color: "text-red-500" },
    { label: L("Avg wait", "Сред. ожидание", "O‘rt. kutish"),     value: data?.avg_wait_sec ? formatDuration(data.avg_wait_sec) : "—",
      icon: Clock, color: "text-amber-600", isString: true },
  ];

  if (!companyId) return (
    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
      {L("Select a company to view analytics.", "Выберите компанию, чтобы посмотреть аналитику.", "Analitikani ko‘rish uchun kompaniyani tanlang.")}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{L("Analytics", "Аналитика", "Analitika")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{L("Today’s live stats · refreshes every 15 s", "Живая статистика за сегодня · обновляется каждые 15 сек", "Bugungi jonli statistika · har 15 soniyada yangilanadi")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statusCards.map(({ label, value, icon: Icon, color, isString }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black">
                  {isLoading ? "—" : (isString ? value : String(value))}
                </p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current queue status */}
      {today && (
        <Card>
          <CardHeader><CardTitle className="text-base">{L("Current queue status", "Текущий статус очереди", "Navbatning joriy holati")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                { label: L("Waiting", "Ожидают", "Kutmoqda"),   value: today.waiting,   color: "bg-amber-100 text-amber-800" },
                { label: L("Called", "Вызваны", "Chaqirilgan"),    value: today.called,    color: "bg-blue-100 text-blue-800" },
                { label: L("Serving", "Обслуживаются", "Xizmatda"),   value: today.serving,   color: "bg-purple-100 text-purple-800" },
                { label: L("Completed", "Завершены", "Yakunlangan"), value: today.completed, color: "bg-green-100 text-green-800" },
                { label: L("No-show", "Не явились", "Kelmagan"),   value: today.noShow,   color: "bg-slate-100 text-slate-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`rounded-xl p-4 ${color}`}>
                  <p className="text-3xl font-black">{value}</p>
                  <p className="mt-0.5 text-xs font-medium">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Hourly chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">{L("Tickets by hour", "Талоны по часам", "Chiptalar soatlar bo‘yicha")}</CardTitle></CardHeader>
          <CardContent>
            {hourlyData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                {L("No data yet today", "Сегодня данных пока нет", "Bugun hali ma’lumot yo‘q")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Source pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">{L("Ticket source", "Источник талонов", "Chipta manbasi")}</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">{L("No data", "Нет данных", "Ma’lumot yo‘q")}</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operator performance */}
      {(data?.operatorPerformance ?? []).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{L("Operator performance (last 30 days)", "Эффективность операторов (30 дней)", "Operatorlar samaradorligi (30 kun)")}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">{L("Operator", "Оператор", "Operator")}</th>
                    <th className="pb-2 font-medium">{L("Completed", "Завершено", "Yakunlangan")}</th>
                    <th className="pb-2 font-medium">{L("Avg service", "Сред. обслуживание", "O‘rt. xizmat")}</th>
                    <th className="pb-2 font-medium">{L("Avg wait", "Сред. ожидание", "O‘rt. kutish")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data!.operatorPerformance!.map((op) => (
                    <tr key={op.operator_id}>
                      <td className="py-2 font-medium">{op.operator_name}</td>
                      <td className="py-2">{op.completed_tickets}</td>
                      <td className="py-2">{op.avg_service_sec ? formatDuration(op.avg_service_sec) : "—"}</td>
                      <td className="py-2">{op.avg_wait_sec ? formatDuration(op.avg_wait_sec) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


