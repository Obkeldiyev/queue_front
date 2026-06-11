import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowLeft, Ticket as TicketIcon, Printer } from "lucide-react";

export const Route = createFileRoute("/kiosk")({
  head: () => ({ meta: [{ title: "Kiosk — Qubit" }] }),
  component: Kiosk,
});

function Kiosk() {
  const { queues, services, currentBranchId, issueTicket, tickets } = useStore();
  const branchQueues = queues.filter((q) => q.branchId === currentBranchId);
  const [issued, setIssued] = useState<string | null>(null);

  const handleSelect = (queueId: string) => {
    const t = issueTicket({ queueId, source: "kiosk" });
    if (t) setIssued(t.id);
  };

  const ticket = issued ? tickets.find((t) => t.id === issued) : null;
  const peopleAhead = ticket ? tickets.filter((t) => t.queueId === ticket.queueId && t.status === "waiting" && t.createdAt < ticket.createdAt).length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30 p-8 text-foreground">
      <div className="absolute left-4 top-4"><Link to="/" className="text-muted-foreground hover:text-foreground"><ArrowLeft /></Link></div>
      <div className="mx-auto max-w-3xl">
        {!ticket ? (
          <>
            <div className="mb-8 text-center">
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Self-service kiosk</div>
              <h1 className="mt-2 text-4xl font-bold">Choose a service</h1>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {branchQueues.map((q) => {
                const svc = services.find((s) => s.id === q.serviceId);
                return (
                  <button key={q.id} onClick={() => handleSelect(q.id)} className="group rounded-2xl border-2 bg-card p-8 text-left transition hover:border-primary hover:shadow-xl">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><TicketIcon /></div>
                    <div className="text-xl font-bold">{q.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{svc?.description ?? ""}</div>
                    <div className="mt-3 text-xs text-muted-foreground">Avg: {svc?.avgTime ?? 10} min · Prefix {q.prefix}</div>
                  </button>
                );
              })}
              {branchQueues.length === 0 && <div className="col-span-full rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No queues configured for this branch.</div>}
            </div>
          </>
        ) : (
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border-2 border-dashed border-primary/40 bg-card p-8 text-center shadow-xl">
              <Printer className="mx-auto mb-3 h-8 w-8 text-primary" />
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Your ticket</div>
              <div className="my-4 text-8xl font-black tracking-wider text-primary">{ticket.number}</div>
              <div className="text-lg">{services.find((s) => s.id === ticket.serviceId)?.name}</div>
              <div className="mt-3 text-sm text-muted-foreground">People ahead of you: <span className="font-bold text-foreground">{peopleAhead}</span></div>
              <div className="mt-1 text-sm text-muted-foreground">Issued at {new Date(ticket.createdAt).toLocaleTimeString()}</div>
              <div className="mx-auto mt-5 grid h-24 w-24 grid-cols-8 gap-px rounded bg-foreground p-1">
                {Array.from({ length: 64 }).map((_, i) => <div key={i} className={(i * ticket.number.length) % 3 ? "bg-background" : "bg-foreground"} />)}
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button className="flex-1" onClick={() => setIssued(null)}>Issue another</Button>
              <Link to="/display" className="flex-1"><Button variant="outline" className="w-full">Open display</Button></Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
