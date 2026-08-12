import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { auditApi, type AuditLog } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { formatDuration } from "@/lib/queue-helpers";
import { Clock, Users } from "lucide-react";

export const Route = createFileRoute("/app/audit")({ beforeLoad: requireCompanyAdmin, component: Audit });

function calcWorkedSeconds(logs: AuditLog[]): number {
  let total = 0; let openAt: number | null = null;
  [...logs].reverse().forEach((log) => {
    if (log.action === "OPEN_SESSION" || log.action === "counter:session_opened") { openAt = new Date(log.created_at).getTime(); }
    else if ((log.action === "CLOSE_SESSION" || log.action === "counter:session_closed") && openAt !== null) { total += (new Date(log.created_at).getTime() - openAt) / 1000; openAt = null; }
  });
  if (openAt !== null) total += (Date.now() - openAt) / 1000;
  return Math.round(total);
}

const ACTION_COLOR: Record<string, string> = {
  CREATE: "border-green-300 text-green-700", UPDATE: "border-blue-300 text-blue-700",
  DELETE: "border-red-300 text-red-700", LOGIN: "border-purple-300 text-purple-700",
  LOGOUT: "border-slate-300 text-slate-500",
  OPEN_SESSION: "border-green-300 text-green-700 bg-green-50", "counter:session_opened": "border-green-300 text-green-700 bg-green-50",
  CLOSE_SESSION: "border-slate-300 text-slate-600", "counter:session_closed": "border-slate-300 text-slate-600",
  CALL_NEXT: "border-amber-300 text-amber-700", "ticket:called": "border-amber-300 text-amber-700",
  COMPLETE_SERVICE: "border-green-300 text-green-700", "ticket:completed": "border-green-300 text-green-700",
};

function Audit() {
  const { user } = useAuthStore();
  const { currentCompanyId } = useStore();
  const { t } = useLang();
  const companyId = user?.company_id ?? currentCompanyId;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", companyId],
    queryFn: () => auditApi.list({ ...(companyId && { company_id: companyId }), limit: "500" }).then((r) => r.data),
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const operatorSummary = useMemo(() => {
    const byActor = new Map<string, { name: string; logs: AuditLog[] }>();
    (logs as AuditLog[]).forEach((log) => {
      const actor = log.company_user;
      if (!actor) return;
      if (!byActor.has(actor.id)) byActor.set(actor.id, { name: `${actor.first_name} ${actor.last_name}`, logs: [] });
      byActor.get(actor.id)!.logs.push(log);
    });
    return Array.from(byActor.entries()).map(([id, { name, logs: al }]) => ({
      id, name,
      workedSeconds: calcWorkedSeconds(al),
      sessionCount: al.filter((l) => l.action === "OPEN_SESSION" || l.action === "counter:session_opened").length,
      ticketsServed: al.filter((l) => l.action === "COMPLETE_SERVICE" || l.action === "ticket:completed").length,
    }));
  }, [logs]);

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold">{t("auditLog")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Full activity log. Session durations calculated from open/close pairs.</p>
      </div>

      {operatorSummary.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-4 w-4" /> {t("workedTime")} by operator
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {operatorSummary.map((op) => (
              <Card key={op.id}>
                <CardHeader className="pb-1"><CardTitle className="text-sm font-semibold">{op.name}</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-mono font-bold text-foreground">{formatDuration(op.workedSeconds)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{op.sessionCount} {t("sessionsCount").toLowerCase()}</span>
                    <span>·</span>
                    <span>{op.ticketsServed} {t("ticketsServed").toLowerCase()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : (logs as AuditLog[]).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">No activity yet.</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Time</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead>
              <TableHead>Entity</TableHead><TableHead>IP</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(logs as AuditLog[]).map((a) => {
                const actor = a.company_user ? `${a.company_user.first_name} ${a.company_user.last_name}` : a.platform_user ? `${a.platform_user.first_name} ${a.platform_user.last_name}` : a.actor_type ?? "system";
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-medium">{actor}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-xs ${ACTION_COLOR[a.action] ?? "border-slate-200 text-slate-500"}`}>{a.action}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.entity_type ?? "—"}{a.entity_id && <span className="ml-1 opacity-50">#{a.entity_id.slice(0, 8)}</span>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.ip_address ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

