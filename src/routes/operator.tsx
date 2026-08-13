import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queuesApi, countersApi, analyticsApi, auditApi, type Ticket, type AuditLog } from "@/lib/api";
import { getUserFromStorage, useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { useLang, LANGS, loc, type TFn, type Lang } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PhoneCall, RotateCw, CheckCircle2, XCircle, ArrowRightLeft,
  PlayCircle, StopCircle, History, LogOut, UserCheck,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { estimateWaitTime, formatDuration } from "@/lib/queue-helpers";
import ClientTime from "@/components/ClientTime";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/operator")({
  head: () => ({ meta: [{ title: "Operator — Qubit QMS" }] }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("qms_access_token");
    const user = getUserFromStorage();
    if (!token && !user) throw redirect({ to: "/login" as any });
    if (user) {
      const isOp = user.type === "company_user" &&
        (user.roleTypes?.includes("OPERATOR") || user.roles?.includes("Operator"));
      if (!isOp) throw redirect({ to: "/app" as any });
    }
  },
  component: () => (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
      }
    >
      <OperatorView />
    </ClientOnly>
  ),
});

const STATUS_COLORS: Record<string, string> = {
  WAITING:   "bg-amber-100 text-amber-800 border-amber-200",
  CALLED:    "bg-blue-100 text-blue-800 border-blue-200",
  SERVING:   "bg-purple-100 text-purple-800 border-purple-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  NO_SHOW:   "bg-slate-100 text-slate-500 border-slate-200",
  CANCELLED: "bg-red-100 text-red-800 border-red-200",
};

function calcWorkedSeconds(logs: AuditLog[]): number {
  let total = 0;
  let openAt: number | null = null;
  [...logs].reverse().forEach((log) => {
    if (log.action === "OPEN_SESSION" || log.action === "counter:session_opened") {
      openAt = new Date(log.created_at).getTime();
    } else if ((log.action === "CLOSE_SESSION" || log.action === "counter:session_closed") && openAt !== null) {
      total += (new Date(log.created_at).getTime() - openAt) / 1000;
      openAt = null;
    }
  });
  if (openAt !== null) total += (Date.now() - openAt) / 1000;
  return Math.round(total);
}

function OperatorView() {
  const { user, logout } = useAuthStore();
  const { currentBranchId, operatorSessionActive, operatorCounterId, setOperatorSessionActive, setOperatorCounterId, setCurrentBranch } = useStore();
  const { lang, setLang, t } = useLang();
  const qc = useQueryClient();
  const { loadUser } = useAuthStore();

  const branchId = currentBranchId || user?.branch_id || "";

  useEffect(() => {
    if (!currentBranchId && user?.branch_id) setCurrentBranch(user.branch_id);
  }, [user?.branch_id, currentBranchId, setCurrentBranch]);

  useEffect(() => { void loadUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<"call" | "audit">("call");

  // ── Counters ──────────────────────────────────────────────────────────────
  const { data: counters = [] } = useQuery({
    queryKey: ["counters", branchId],
    queryFn: () => countersApi.list({ branch_id: branchId }).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const assignedCounterId: string = user?.default_counter_id || operatorCounterId || "";

  const { data: counterDetail } = useQuery({
    queryKey: ["counter-detail", assignedCounterId],
    queryFn: () => countersApi.get(assignedCounterId).then((r) => r.data),
    enabled: !!assignedCounterId,
    staleTime: 0,
    refetchInterval: 10_000,
  });

  const counter = counterDetail ?? counters.find((c) => c.id === assignedCounterId);
  const counterName = counter ? loc(counter as unknown as Record<string, unknown>, "name", lang) || counter.name_uz : "";

  type CounterQueueEntry = { queue_group: { id: string; name_uz: string; name_ru?: string; name_en?: string; service?: { name_uz: string; estimated_time_mins?: number } } };
  const rawQueueGroups = (counter?.queue_groups ?? []) as CounterQueueEntry[];
  const queueIds = rawQueueGroups.map((cq) => cq.queue_group?.id ?? "").filter(Boolean);
  const counterQueueNames = rawQueueGroups.map((cq) => cq.queue_group?.name_uz ?? "").filter(Boolean);

  // If the operator has allowed_service_ids, filter counter queue groups to only those services
  const operatorAllowedServiceIdsRaw = user && (user as any).allowed_service_ids;
  const operatorAllowedServiceIds: string[] | null = operatorAllowedServiceIdsRaw
    ? (Array.isArray(operatorAllowedServiceIdsRaw) ? operatorAllowedServiceIdsRaw : JSON.parse(String(operatorAllowedServiceIdsRaw)))
    : null;

  const effectiveQueueIds = operatorAllowedServiceIds && operatorAllowedServiceIds.length > 0
    ? rawQueueGroups
        .filter((cq) => operatorAllowedServiceIds?.includes(cq.queue_group?.service?.id ?? ""))
        .map((cq) => cq.queue_group?.id ?? "")
        .filter(Boolean)
    : queueIds;

  // ── Waiting tickets ───────────────────────────────────────────────────────
  const { data: waitingTickets = [] } = useQuery({
    queryKey: ["tickets", branchId, "WAITING"],
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, status: "WAITING", limit: "200" }).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 4000,
  });

  // ── Active tickets (CALLED/SERVING) ───────────────────────────────────────
  const { data: activeTickets = [] } = useQuery({
    queryKey: ["tickets", branchId, "active"],
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, limit: "100" }).then((r) =>
      r.data.filter((t: Ticket) => ["CALLED", "SERVING"].includes(t.status))
    ),
    enabled: !!branchId,
    refetchInterval: 3000,
  });

  const waiting = useMemo(() => {
    const all = waitingTickets as Ticket[];
    const filtered = assignedCounterId && queueIds.length > 0
      ? all.filter((t) => queueIds.includes(t.queue_group_id))
      : [];
    return [...filtered].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [waitingTickets, queueIds, assignedCounterId]);

  const current = useMemo(() =>
    (activeTickets as Ticket[]).find((t) => t.counter_id === assignedCounterId && ["CALLED", "SERVING"].includes(t.status)),
    [activeTickets, assignedCounterId]
  );

  // ── Audit ─────────────────────────────────────────────────────────────────
  const { data: myLogs = [] } = useQuery({
    queryKey: ["audit-logs", "operator", user?.id],
    queryFn: () => auditApi.list({ ...(user?.company_id && { company_id: user.company_id }), limit: "200" })
      .then((r) => r.data.filter((l: AuditLog) => l.company_user?.id === user?.id)),
    enabled: !!user?.id && activeTab === "audit",
    refetchInterval: 30_000,
  });
  const workedSeconds = useMemo(() => calcWorkedSeconds(myLogs as AuditLog[]), [myLogs]);

  const { data: selfStats } = useQuery({
    queryKey: ["operator-self-stats", user?.id],
    queryFn: () => analyticsApi.operatorStats(user!.id, { ...(branchId && { branch_id: branchId }), days: "30" }).then((r) => r.data),
    enabled: !!user?.id && activeTab === "audit",
    refetchInterval: 60_000,
  });

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useRealtime({
    branchId,
    enabled: !!branchId,
    onTicketIssued: () => void qc.invalidateQueries({ queryKey: ["tickets", branchId, "WAITING"] }),
    onTicketCalled: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
    onTicketCompleted: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  // ── Session mutations ─────────────────────────────────────────────────────
  const openSessionMutation = useMutation({
    mutationFn: () => countersApi.openSession(assignedCounterId || undefined).then((r) => r.data),
    onSuccess: (session) => {
      const sid = (session as { counter?: { id?: string } } | null)?.counter?.id ?? assignedCounterId;
      if (sid) setOperatorCounterId(String(sid));
      setOperatorSessionActive(true);
      toast.success(t("sessionActive"));
      void qc.invalidateQueries({ queryKey: ["counters"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start session"),
  });

  const closeSessionMutation = useMutation({
    mutationFn: () => countersApi.closeSession().then((r) => r.data),
    onSuccess: () => {
      setOperatorSessionActive(false);
      toast.success(t("sessionInactive"));
      void qc.invalidateQueries({ queryKey: ["counters"] });
      void qc.invalidateQueries({ queryKey: ["audit-logs", "operator", user?.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not end session"),
  });

  // ── Ticket mutations ──────────────────────────────────────────────────────
  const callNextMutation = useMutation({
    mutationFn: async () => {
      if (!assignedCounterId) throw new Error("No counter assigned.");
      return queuesApi.callNext(assignedCounterId).then((r) => r.data);
    },
    onSuccess: (ticket) => {
      toast.success(`Calling ${(ticket as unknown as Ticket).ticket_number}${counterName ? ` → ${counterName}` : ""}`);
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No tickets waiting"),
  });

  const serveMutation = useMutation({
    mutationFn: (id: string) => queuesApi.startServing(id).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => queuesApi.completeTicket(id).then((r) => r.data),
    onSuccess: () => { toast.success("Ticket completed"); void qc.invalidateQueries({ queryKey: ["tickets"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const recallMutation = useMutation({
    mutationFn: (id: string) => queuesApi.recallTicket(id).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const noShowMutation = useMutation({
    mutationFn: (id: string) => queuesApi.noShow(id).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => queuesApi.transferTicket(id, { to_counter_id: to }).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tickets"] }),
  });

  const handleLogout = async () => {
    if (operatorSessionActive) await closeSessionMutation.mutateAsync().catch(() => null);
    setOperatorCounterId(undefined);
    await logout();
    window.location.href = "/login";
  };

  if (!branchId) return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="rounded-2xl border border-dashed p-12 text-center max-w-sm">
        <div className="text-4xl mb-4">🏢</div>
        <p className="font-semibold">No branch assigned</p>
        <p className="mt-2 text-sm text-muted-foreground">Ask your admin to assign a branch in the Employees page.</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-sm">Q</div>
        <span className="font-bold text-sm">Qubit QMS</span>
        <span className="text-muted-foreground text-xs hidden sm:block">— {t("operatorConsole")}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
          <span className="hidden text-xs text-muted-foreground md:block">{user?.first_name} {user?.last_name}</span>
          <button onClick={() => void handleLogout()}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </button>
        </div>
      </header>

      {/* Session banner */}
      {!operatorSessionActive ? (
        <div className={`border-b px-4 py-3 flex items-center justify-between gap-4 ${assignedCounterId ? "bg-amber-50 dark:bg-amber-950" : "bg-red-50 dark:bg-red-950"}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${assignedCounterId ? "bg-amber-200 dark:bg-amber-800" : "bg-red-200 dark:bg-red-800"}`}>
              <PlayCircle className={`h-5 w-5 ${assignedCounterId ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300"}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${assignedCounterId ? "text-amber-900 dark:text-amber-100" : "text-red-900 dark:text-red-100"}`}>
              {assignedCounterId ? t("startWork") : "Start work"}
            </p>
            <p className={`text-xs ${assignedCounterId ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {assignedCounterId
                ? `${t("myCounter")}: ${counterName || assignedCounterId.slice(0, 8)}`
                : "No default counter assigned — a counter will be selected automatically"}
            </p>
            </div>
          </div>
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            onClick={() => openSessionMutation.mutate()} disabled={openSessionMutation.isPending}>
            <PlayCircle className="mr-1.5 h-4 w-4" />
            {openSessionMutation.isPending ? "…" : t("startWork")}
          </Button>
        </div>
      ) : (
        <div className="border-b bg-green-50 dark:bg-green-950 px-4 py-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <div>
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                {t("sessionActive")} — {counterName}
                {counter?.number != null && (
                  <span className="ml-2 rounded bg-green-200 dark:bg-green-800 px-1.5 py-0.5 text-xs font-bold">#{counter.number}</span>
                )}
              </span>
              {counterQueueNames.length > 0 ? (
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  {lang === "uz" ? "Navbatlar" : lang === "ru" ? "Очереди" : "Queues"}: {counterQueueNames.join(", ")}
                </p>
              ) : (
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 font-medium">
                  ⚠ {lang === "uz" ? "Bu kabinetga navbat bog'lanmagan" : lang === "ru" ? "Очереди не привязаны к кабинету" : "No queues linked to this counter"}
                </p>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 shrink-0"
            onClick={() => closeSessionMutation.mutate()} disabled={closeSessionMutation.isPending}>
            <StopCircle className="mr-1.5 h-4 w-4" />
            {closeSessionMutation.isPending ? "…" : t("endWork")}
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b bg-card px-4 pt-2">
        {(["call", "audit"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition border-b-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {tab === "call"
              ? <span className="flex items-center gap-1.5"><PhoneCall className="h-3.5 w-3.5" />{t("callNext")}</span>
              : <span className="flex items-center gap-1.5"><History className="h-3.5 w-3.5" />{t("myAudit")}</span>}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {activeTab === "call" ? (
          <CallTab
            current={current} waiting={waiting} counters={counters}
            assignedCounterId={assignedCounterId} counterName={counterName}
            operatorSessionActive={operatorSessionActive} lang={lang} t={t} queueIds={queueIds}
            callNextMutation={callNextMutation} serveMutation={serveMutation}
            completeMutation={completeMutation} recallMutation={recallMutation}
            noShowMutation={noShowMutation} transferMutation={transferMutation}
            counter={counter}
          />
        ) : (
          <AuditTab logs={myLogs as AuditLog[]} workedSeconds={workedSeconds} selfStats={selfStats} t={t} />
        )}
      </main>
    </div>
  );
}

// ─── CallTab ──────────────────────────────────────────────────────────────────
interface CallTabProps {
  current: Ticket | undefined;
  waiting: Ticket[];
  counters: import("@/lib/api").Counter[];
  assignedCounterId: string;
  counterName: string;
  operatorSessionActive: boolean;
  lang: Lang;
  t: TFn;
  queueIds: string[];
  callNextMutation:  { mutate: () => void; isPending: boolean };
  serveMutation:     { mutate: (id: string) => void; isPending: boolean };
  completeMutation:  { mutate: (id: string) => void; isPending: boolean };
  recallMutation:    { mutate: (id: string) => void; isPending: boolean };
  noShowMutation:    { mutate: (id: string) => void; isPending: boolean };
  transferMutation:  { mutate: (args: { id: string; to: string }) => void; isPending: boolean };
  counter: import("@/lib/api").Counter | undefined;
}

function CallTab({ current, waiting, counters, assignedCounterId, counterName, operatorSessionActive, lang, t, queueIds, callNextMutation, serveMutation, completeMutation, recallMutation, noShowMutation, transferMutation, counter }: CallTabProps) {
  const hasActive = !!current;
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{counterName || t("pickCounter")}</span>
            <Badge variant={operatorSessionActive ? "default" : "secondary"} className="text-[10px] uppercase">
              {operatorSessionActive ? t("sessionActive") : t("sessionInactive")}
            </Badge>
          </div>

          {current ? (
            <>
              <div className={`rounded-2xl border-2 py-8 text-center ${current.status === "SERVING" ? "border-purple-200 bg-purple-50 dark:bg-purple-950/30" : "border-primary/20 bg-primary/5"}`}>
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  {current.status === "SERVING" ? (lang === "uz" ? "Xizmatda" : lang === "ru" ? "Обслуживается" : "Serving") : t("called")}
                </div>
                <div className={`text-[5.5rem] font-black leading-none tracking-wider ${current.status === "SERVING" ? "text-purple-600" : "text-primary"}`}>
                  {current.ticket_number}
                </div>
                {current.queue_group && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {loc(current.queue_group as unknown as Record<string, unknown>, "name", lang)}
                  </div>
                )}
                <Badge className={`mt-3 ${STATUS_COLORS[current.status] ?? ""} border`} variant="outline">
                  {t(current.status.toLowerCase() as "waiting")}
                </Badge>
              </div>

              <div className="mt-4 space-y-2">
                {current.status === "CALLED" && (
                  <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => serveMutation.mutate(current.id)} disabled={serveMutation.isPending}>
                    <UserCheck className="h-4 w-4" />
                    {serveMutation.isPending ? "…" : (lang === "uz" ? "Xizmat boshlash" : lang === "ru" ? "Начать обслуживание" : "Start Serving")}
                  </Button>
                )}
                {current.status === "SERVING" && (
                  <Button className="w-full gap-2" onClick={() => completeMutation.mutate(current.id)} disabled={completeMutation.isPending}>
                    <CheckCircle2 className="h-4 w-4" />
                    {completeMutation.isPending ? "…" : t("complete")}
                  </Button>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" onClick={() => recallMutation.mutate(current.id)} disabled={recallMutation.isPending}>
                    <RotateCw className="mr-1.5 h-3.5 w-3.5" />{t("recall")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => noShowMutation.mutate(current.id)} disabled={noShowMutation.isPending}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />{t("noShow")}
                  </Button>
                  <Select onValueChange={(to) => transferMutation.mutate({ id: current.id, to })}>
                    <SelectTrigger className="h-9">
                      <span className="flex items-center gap-1 text-xs"><ArrowRightLeft className="h-3 w-3" />{t("transfer")}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {counters.filter((c) => c.id !== assignedCounterId).length === 0
                        ? <div className="px-3 py-2 text-xs text-muted-foreground">No other counters</div>
                        : counters.filter((c) => c.id !== assignedCounterId).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-black text-primary">{c.number}</span>
                              {loc(c as unknown as Record<string, unknown>, "name", lang) || c.name_uz}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              {operatorSessionActive ? t("noActiveTkt") : `${lang === "uz" ? "Boshlash uchun" : lang === "ru" ? "Нажмите" : "Press"} "${t("startWork")}"`}
            </div>
          )}

          <div className="mt-5 flex flex-col items-center gap-2">
            <Button size="lg" className="w-full max-w-xs gap-2 text-base"
              onClick={() => callNextMutation.mutate()}
              disabled={callNextMutation.isPending || !assignedCounterId || !operatorSessionActive || hasActive || queueIds.length === 0}>
              <PhoneCall className="h-5 w-5" />
              {callNextMutation.isPending ? (lang === "uz" ? "Chaqirilmoqda…" : lang === "ru" ? "Вызов…" : "Calling…") : t("callNext")}
            </Button>
            {queueIds.length === 0 && operatorSessionActive && assignedCounterId && (
              <p className="text-xs text-amber-600">
                {lang === "uz" ? "Sizning kabinetingizga navbatlar biriktirilmagan" : lang === "ru" ? "К вашему кабинету не привязаны очереди" : "No queues are assigned to your counter"}
              </p>
            )}
            {hasActive && operatorSessionActive && (
              <p className="text-xs text-muted-foreground">
                {lang === "uz" ? "Avval joriy chiptani tugatng" : lang === "ru" ? "Сначала завершите текущий талон" : "Complete the current ticket first"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Waiting queue */}
      <div className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">{t("waiting")}</span>
          <Badge variant="secondary">{waiting.length}</Badge>
        </div>
        <div className="max-h-[65vh] overflow-y-auto divide-y">
          {waiting.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {lang === "uz" ? "Kutayotgan yo'q" : lang === "ru" ? "Нет ожидающих" : "No tickets waiting"}
              </p>
              {queueIds.length === 0 && assignedCounterId && (
                <p className="text-xs text-amber-600 px-4">
                  {lang === "uz" ? "Kabinetga navbat bog'lanmagan" : lang === "ru" ? "К кабинету не привязаны очереди" : "Counter has no queues linked. Go to Admin → Counters."}
                </p>
              )}
            </div>
          ) : (
            waiting.map((ticket, idx) => (
              <div key={ticket.id} className={`flex items-center justify-between px-4 py-3 text-sm ${idx === 0 ? "bg-primary/5" : ""}`}>
                <div>
                  <div className="font-mono font-bold">{ticket.ticket_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {ticket.queue_group ? loc(ticket.queue_group as unknown as Record<string, unknown>, "name", lang) : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground"><ClientTime iso={ticket.created_at} /></div>
                  <div className="text-[10px] font-medium text-primary">
                    {idx === 0 ? (lang === "uz" ? "Keyingi" : lang === "ru" ? "Следующий" : "Next")
                      : estimateWaitTime(idx, counter?.queue_groups?.[0]?.queue_group?.service?.estimated_time_mins)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AuditTab ─────────────────────────────────────────────────────────────────
const ACTION_PILL: Record<string, string> = {
  OPEN_SESSION: "bg-green-100 text-green-800", "counter:session_opened": "bg-green-100 text-green-800",
  CLOSE_SESSION: "bg-slate-100 text-slate-600", "counter:session_closed": "bg-slate-100 text-slate-600",
  CALL_NEXT: "bg-blue-100 text-blue-800", "ticket:called": "bg-blue-100 text-blue-800",
  COMPLETE_SERVICE: "bg-emerald-100 text-emerald-800", "ticket:completed": "bg-emerald-100 text-emerald-800",
  NO_SHOW: "bg-slate-100 text-slate-500", "ticket:no_show": "bg-slate-100 text-slate-500",
};

interface AuditTabProps { logs: AuditLog[]; workedSeconds: number; selfStats: Record<string, unknown> | undefined; t: TFn; }

function AuditTab({ logs, workedSeconds, selfStats, t }: AuditTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("workedTime"),    value: formatDuration(workedSeconds) },
          { label: t("ticketsServed"), value: String((selfStats as { served?: number } | undefined)?.served ?? 0) },
          { label: t("sessionsCount"), value: String((selfStats as { sessions_count?: number } | undefined)?.sessions_count ?? 0) },
          { label: t("avgServiceTime"), value: (selfStats as { avg_service_sec?: number } | undefined)?.avg_service_sec ? formatDuration((selfStats as { avg_service_sec: number }).avg_service_sec) : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1.5 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{t("myAudit")}</span>
          <span className="ml-auto text-xs text-muted-foreground">{logs.length} events</span>
        </div>
        {logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="divide-y max-h-[55vh] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-36 shrink-0 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${ACTION_PILL[log.action] ?? "bg-muted text-muted-foreground"}`}>{log.action}</span>
                {log.entity_type && <span className="text-xs text-muted-foreground truncate">{log.entity_type}{log.entity_id ? ` #${log.entity_id.slice(0, 6)}` : ""}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
