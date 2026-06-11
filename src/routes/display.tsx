import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/display")({
  head: () => ({ meta: [{ title: "Display — Qubit" }] }),
  component: DisplayView,
});

function DisplayView() {
  const { tickets, counters, queues, branches, currentBranchId } = useStore();
  const branch = branches.find((b) => b.id === currentBranchId);
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const branchCounters = counters.filter((c) => c.branchId === currentBranchId);
  const activeCalls = tickets
    .filter((t) => t.branchId === currentBranchId && (t.status === "called" || t.status === "serving"))
    .sort((a, b) => (b.calledAt ?? "").localeCompare(a.calledAt ?? ""));
  const recent = activeCalls.slice(0, 6);
  const latest = activeCalls[0];

  return (
    <div className="min-h-screen bg-[oklch(0.12_0.03_250)] p-8 text-white">
      <div className="absolute left-4 top-4"><Link to="/" className="text-white/40 hover:text-white"><ArrowLeft /></Link></div>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-white/40">Now serving</div>
            <h1 className="mt-1 text-4xl font-bold">{branch?.name ?? "Waiting Area"}</h1>
          </div>
          <div className="text-right">
            <div className="text-5xl font-mono font-bold tabular-nums">{now.toLocaleTimeString()}</div>
            <div className="mt-1 text-sm text-white/40">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-3xl bg-gradient-to-br from-[oklch(0.55_0.18_230)] to-[oklch(0.72_0.16_180)] p-12 text-center shadow-2xl">
            {latest ? (
              <>
                <div className="text-xs uppercase tracking-[0.3em] text-white/70">Now serving</div>
                <div className="mt-2 text-[10rem] font-black leading-none tracking-wider">{latest.number}</div>
                <div className="mt-4 text-3xl font-semibold">→ {counters.find((c) => c.id === latest.counterId)?.name}</div>
                <div className="mt-2 text-white/70">{queues.find((q) => q.id === latest.queueId)?.name}</div>
              </>
            ) : (
              <div className="py-20 text-3xl text-white/70">Awaiting first call…</div>
            )}
          </div>

          <div className="rounded-3xl bg-white/5 p-6 backdrop-blur">
            <div className="mb-4 text-xs uppercase tracking-[0.3em] text-white/40">Counter status</div>
            <div className="space-y-2">
              {branchCounters.map((c) => {
                const t = activeCalls.find((x) => x.counterId === c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                    <span className="text-lg font-medium">{c.name}</span>
                    <span className={`font-mono text-2xl font-bold ${t ? "text-[oklch(0.72_0.16_180)]" : "text-white/30"}`}>{t?.number ?? "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white/5 p-6 backdrop-blur">
          <div className="mb-4 text-xs uppercase tracking-[0.3em] text-white/40">Recent calls</div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {recent.map((t) => (
              <div key={t.id} className="rounded-2xl bg-white/5 p-4 text-center">
                <div className="text-3xl font-bold tabular-nums">{t.number}</div>
                <div className="text-xs text-white/40">→ {counters.find((c) => c.id === t.counterId)?.name}</div>
              </div>
            ))}
            {recent.length === 0 && <div className="col-span-full py-6 text-center text-white/40">No recent calls</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
