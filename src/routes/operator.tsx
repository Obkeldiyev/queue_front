import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, EmptyState } from "@/components/qms/ui";
import { ArrowLeft, PhoneCall, RotateCw, CheckCircle2, XCircle, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/operator")({
  head: () => ({ meta: [{ title: "Operator — Qubit" }] }),
  component: OperatorView,
});

function OperatorView() {
  const { counters, queues, tickets, currentBranchId, employees, callNext, recall, completeTicket, noShow, transferTicket } = useStore();
  const branchCounters = counters.filter((c) => c.branchId === currentBranchId);
  const [counterId, setCounterId] = useState<string>(branchCounters[0]?.id ?? "");
  const counter = branchCounters.find((c) => c.id === counterId);
  const operator = employees.find((e) => e.id === counter?.operatorId);

  const myQueueTickets = tickets.filter((t) => counter && counter.queueIds.includes(t.queueId));
  const waiting = myQueueTickets.filter((t) => t.status === "waiting").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current = myQueueTickets.filter((t) => t.counterId === counterId && (t.status === "called" || t.status === "serving"))[0];

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
          <h1 className="text-2xl font-bold">Operator Console</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Counter</span>
            <Select value={counterId} onValueChange={setCounterId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Pick a counter" /></SelectTrigger>
              <SelectContent>{branchCounters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!counter ? <EmptyState title="Pick a counter to start" /> : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Now serving at {counter.name}{operator ? ` · ${operator.name}` : ""}</CardTitle>
              </CardHeader>
              <CardContent>
                {current ? (
                  <div>
                    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-10 text-center">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">Current ticket</div>
                      <div className="mt-2 text-7xl font-black tracking-wider text-primary">{current.number}</div>
                      <div className="mt-2 text-sm text-muted-foreground">{queues.find((q) => q.id === current.queueId)?.name}</div>
                      <StatusBadge status={current.status} />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Button onClick={() => { recall(current.id); toast.success("Recalled"); }} variant="outline"><RotateCw className="mr-2 h-4 w-4" />Recall</Button>
                      <Button onClick={() => { completeTicket(current.id); toast.success("Completed"); }}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>
                      <Button onClick={() => { noShow(current.id); toast.success("Marked no-show"); }} variant="outline"><XCircle className="mr-2 h-4 w-4" />No-show</Button>
                      <Select onValueChange={(v) => { transferTicket(current.id, v); toast.success("Transferred"); }}>
                        <SelectTrigger><span className="flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />Transfer</span></SelectTrigger>
                        <SelectContent>{branchCounters.filter((c) => c.id !== counter.id).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No active ticket. Press “Call next”.</div>
                )}
                <div className="mt-6 flex justify-center">
                  <Button size="lg" onClick={() => { const t = callNext(counter.id, counter.operatorId); if (!t) toast.error("No one waiting"); else toast.success(`Calling ${t.number}`); }}>
                    <PhoneCall className="mr-2 h-5 w-5" />Call next
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Waiting ({waiting.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {waiting.length === 0 ? <div className="text-sm text-muted-foreground">Nobody waiting</div> : waiting.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <div>
                      <div className="font-mono font-bold">{t.number}</div>
                      <div className="text-xs text-muted-foreground">{queues.find((q) => q.id === t.queueId)?.name}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
