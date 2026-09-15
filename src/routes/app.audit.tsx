import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { api, auditApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationsPanel } from "@/components/qms/OperationsPanel";
import { formatDuration } from "@/lib/queue-helpers";
import { toast } from "sonner";
export const Route = createFileRoute("/app/audit")({
  beforeLoad: requireCompanyAdmin,
  component: Audit,
});
function Audit() {
  const { lang, t } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const { currentBranchId } = useStore();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("");
  const params = {
    page: String(page),
    limit: "25",
    ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
    ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    ...(filter ? { action: filter } : {}),
  };
  const {
    data: result,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditApi.list(params),
    refetchInterval: 15000,
  });
  const { data: summary = [], error: summaryError } = useQuery({
    queryKey: ["operations-summary", from, to],
    queryFn: () =>
      api
        .get<any[]>(`/operations/summary?${new URLSearchParams({ ...params, page: "1" })}`)
        .then((r) => r.data),
    refetchInterval: 15000,
  });
  const pay = useMutation({
    mutationFn: ({ id, salary, rate }: { id: string; salary: number; rate: number }) =>
      api.patch(`/operations/compensation/${id}`, { salary, rate }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["operations-summary"] });
      toast.success(L("Compensation saved", "Оплата сохранена", "To‘lov saqlandi"));
    },
    onError: (e) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => api.post<any>("/operations/reset", { branch_id: currentBranchId }),
    onSuccess: (r) => {
      toast.success(`${r.data.count} ${L("tickets reset", "талонов сброшено", "talon tiklandi")}`);
      void qc.invalidateQueries();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {L("Operations & audit", "Контроль и аудит", "Nazorat va audit")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {L(
              "Actual work sessions, completed services and KPI earnings. Default period: current month.",
              "Рабочие сессии, завершённые обращения и KPI. Период по умолчанию: текущий месяц.",
              "Ish seanslari, bajarilgan xizmatlar va KPI. Standart davr: joriy oy.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={!currentBranchId || reset.isPending}
          onClick={() => {
            if (
              confirm(
                L(
                  "Cancel all waiting and active tickets in this branch? History is retained.",
                  "Отменить все ожидающие и активные талоны филиала? История сохранится.",
                  "Filialdagi kutilayotgan va faol talonlar bekor qilinsinmi? Tarix saqlanadi.",
                ),
              )
            )
              reset.mutate();
          }}
        >
          {L("Reset branch queue", "Сбросить очередь филиала", "Filial navbatini tiklash")}
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label>
          {L("From", "С", "Dan")}
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          {L("To", "По", "Gacha")}
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="rounded border bg-background p-2"
          aria-label="Action"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{L("All actions", "Все действия", "Barcha harakatlar")}</option>
          {[
            "CREATE",
            "UPDATE",
            "DELETE",
            "LOGIN",
            "TOGGLE_STATUS",
            "CALL_NEXT",
            "COMPLETE_SERVICE",
            "TRANSFER",
          ].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      {summaryError && (
        <p role="alert" className="text-destructive">
          {summaryError.message}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((op) => (
          <div key={op.id} className="space-y-3 rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <strong>
                {op.first_name} {op.last_name}
              </strong>
              <span
                className={`rounded-full px-2 py-1 text-xs ${op.online ? "bg-green-100 text-green-800" : "bg-muted"}`}
              >
                {op.online
                  ? L("Working", "Работает", "Ishlamoqda")
                  : L("Offline", "Не работает", "Oflayn")}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{t("ticketsServed")}</p>
                <strong className="text-3xl">{op.served}</strong>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("workedTime")}</p>
                <strong className="text-xl">{formatDuration(op.worked_seconds)}</strong>
              </div>
            </div>
            <p className="text-sm">
              KPI: <strong>{op.earned_kpi.toLocaleString()}</strong> ·{" "}
              {L("Salary", "Оклад", "Maosh")}: {op.salary.toLocaleString()}
            </p>
            {op.alerts.map((a: string) => (
              <p key={a} role="status" className="rounded bg-amber-100 p-2 text-sm text-amber-900">
                {a === "Long open shift"
                  ? L(
                      "Shift exceeds the configured maximum",
                      "Смена дольше установленного лимита",
                      "Smena belgilangan limitdan oshdi",
                    )
                  : L(
                      "Service duration exceeds target",
                      "Обслуживание дольше нормы",
                      "Xizmat vaqti me’yordan oshdi",
                    )}
              </p>
            ))}
            <form
              className="flex flex-wrap gap-2"
              key={`${op.id}:${op.salary}:${op.rate}`}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                pay.mutate({
                  id: op.id,
                  salary: Number(f.get("salary")),
                  rate: Number(f.get("rate")),
                });
              }}
            >
              <label className="text-xs">
                {L("Monthly salary", "Месячный оклад", "Oylik maosh")}
                <Input
                  className="w-28"
                  name="salary"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={op.salary}
                />
              </label>
              <label className="text-xs">
                {L("KPI / service", "KPI / обращение", "KPI / xizmat")}
                <Input
                  className="w-28"
                  name="rate"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={op.rate}
                />
              </label>
              <Button variant="outline" disabled={pay.isPending}>
                {t("save")}
              </Button>
            </form>
          </div>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-destructive">
          {error.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                L("Time", "Время", "Vaqt"),
                L("Operator", "Оператор", "Operator"),
                L("Action", "Действие", "Harakat"),
                L("Entity", "Объект", "Obyekt"),
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result?.data.map((log) => (
              <tr key={log.id} className="border-t">
                <td className="p-3">
                  {new Date(log.created_at).toLocaleString(
                    lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-GB",
                  )}
                </td>
                <td className="p-3">
                  {log.company_user
                    ? `${log.company_user.first_name} ${log.company_user.last_name}`
                    : log.actor_type}
                </td>
                <td className="p-3">{log.action}</td>
                <td className="p-3">{log.entity_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          disabled={page === 1 || isFetching}
          onClick={() => setPage((p) => p - 1)}
        >
          ← {L("Previous", "Назад", "Oldingi")}
        </Button>
        <span>
          {page} / {Math.max(1, Math.ceil((result?.meta?.total || 0) / 25))} ·{" "}
          {result?.meta?.total || 0}
        </span>
        <Button
          variant="outline"
          disabled={isFetching || page * 25 >= (result?.meta?.total || 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          {L("Next", "Далее", "Keyingi")} →
        </Button>
      </div>
      <OperationsPanel admin />
    </div>
  );
}
