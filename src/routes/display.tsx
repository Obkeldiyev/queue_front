import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queuesApi, countersApi, branchesApi, type Ticket, type Counter, companiesApi } from "@/lib/api";
import { useLang, LANGS, loc } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";
import { useEffect, useRef, useState } from "react";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/display")({
  head: () => ({ meta: [{ title: "Display — Qubit QMS" }] }),
  component: () => (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050a14]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      }
    >
      <DisplayView />
    </ClientOnly>
  ),
});

interface Announced { ticket_number: string; counter_name: string; counter_number?: number }

function DisplayView() {
  const { lang, setLang } = useLang();
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [urlBranchId, setUrlBranchId] = useState("");
  const [deviceBranchId, setDeviceBranchId] = useState<string | null>(null);
  const branchId = urlBranchId || deviceBranchId || "";
  const [displayTheme, setDisplayTheme] = useState<"dark" | "light">("dark");
  const isDark = displayTheme !== "light";
  const [announced, setAnnounced] = useState<Announced | null>(null);
  const announceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { const tm = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(tm); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const b = p.get("branch"); const d = p.get("device");
    if (b) setUrlBranchId(b);
    if (d) {
      setDeviceId(d);
      if (!b) void (async () => {
        try {
          const { devicesApi } = await import("@/lib/api");
          const dev = await devicesApi.get(d).then((r) => r.data);
          if (dev?.branch_id) setDeviceBranchId(dev.branch_id);
          if ((dev?.settings as { displayTheme?: string } | undefined)?.displayTheme)
            setDisplayTheme((dev!.settings as { displayTheme: "dark" | "light" }).displayTheme);
        } catch { /* ignore */ }
      })();
    }
    void (async () => {
      try {
        const branchVal = b ?? "";
        if (!branchVal) return;
        const branch = await branchesApi.get(branchVal).then((r) => r.data);
        if (branch?.company_id) {
          const raw = localStorage.getItem(`kiosk_settings_${branch.company_id}`);
          if (raw) {
            const s = JSON.parse(raw) as { displayTheme?: string; theme?: string; settings?: { displayTheme?: string; theme?: string } };
            const preferred = s.displayTheme ?? s.theme ?? s.settings?.displayTheme ?? s.settings?.theme;
            if (preferred) setDisplayTheme(preferred as "dark" | "light");
          }
          try {
            const comp = await companiesApi.get(branch.company_id).then((r) => r.data);
            const s = comp?.settings as { displayTheme?: string; theme?: string } | undefined;
            const preferred = s?.displayTheme ?? s?.theme;
            if (preferred) setDisplayTheme(preferred as "dark" | "light");
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const { data: counters = [] } = useQuery({
    queryKey: ["counters-display", branchId],
    queryFn: () => countersApi.list({ branch_id: branchId }).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const { data: branch } = useQuery({
    queryKey: ["branch-display", branchId],
    queryFn: () => branchesApi.get(branchId).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const { data: calledTickets = [] } = useQuery({
    queryKey: ["tickets-display", branchId],
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, limit: "50" }).then((r) =>
      r.data.filter((t: Ticket) => ["CALLED", "SERVING"].includes(t.status))
    ),
    enabled: !!branchId,
    refetchInterval: 3000,
  });

  const { data: waitingTickets = [] } = useQuery({
    queryKey: ["tickets-display-waiting", branchId],
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, status: "WAITING", limit: "20" }).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 4000,
  });

  useRealtime({
    branchId, enabled: !!branchId,
    onTicketCalled: (msg) => {
      void qc.invalidateQueries({ queryKey: ["tickets-display", branchId] });
      void qc.invalidateQueries({ queryKey: ["tickets-display-waiting", branchId] });
      const num = msg.payload.ticket_number;
      const cname = String(msg.payload.counter_name ?? "");
      if (num) {
        if (announceTimer.current) clearTimeout(announceTimer.current);
        const c = counters.find((x) => x.name_uz === cname || x.id === msg.payload.counter_id);
        setAnnounced({ ticket_number: String(num), counter_name: cname, counter_number: c?.number });
        announceTimer.current = setTimeout(() => setAnnounced(null), 6000);
      }
    },
    onTicketIssued: () => void qc.invalidateQueries({ queryKey: ["tickets-display-waiting", branchId] }),
  });

  const counterTicketMap = new Map<string, Ticket>();
  (calledTickets as Ticket[]).forEach((t) => { if (t.counter_id) counterTicketMap.set(t.counter_id, t); });

  const getCounter = (id?: string): Counter | undefined => counters.find((c) => c.id === id);
  const getLabel = (id?: string) => { const c = getCounter(id); return c ? loc(c as unknown as Record<string, unknown>, "name", lang) || c.name_uz : ""; };
  const getWindow = (ticket?: Ticket | null) => {
    if (!ticket?.counter_id) return "-";
    const counter = getCounter(ticket.counter_id);
    return counter?.number ? String(counter.number) : getLabel(ticket.counter_id) || "-";
  };

  const serving = (calledTickets as Ticket[]).slice(0, 12);
  const latest = serving[0] ?? null;
  const waiting = [...(waitingTickets as Ticket[])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const timeStr = now.toLocaleTimeString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });
  const secStr = now.toLocaleTimeString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { second: "2-digit" }).replace(/[^0-9]/g, "");
  const dateStr = now.toLocaleDateString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { weekday: "long", day: "numeric", month: "long" });

  const W = lang === "uz" ? "Kabinet" : lang === "ru" ? "Кабинет" : "Window";
  const SERVING_LBL = lang === "uz" ? "XIZMAT KO'RSATILMOQDA" : lang === "ru" ? "ОБСЛУЖИВАЕТСЯ" : "NOW SERVING";
  const WAITING_LBL = lang === "uz" ? "NAVBAT" : lang === "ru" ? "ОЖИДАНИЕ" : "WAITING";
  const GO_LBL = lang === "uz" ? "kabinetga boring" : lang === "ru" ? "пройдите в кабинет" : "go to window";
  const EMPTY_LBL = lang === "uz" ? "Hozircha chaqirilgan chipta yo'q" : lang === "ru" ? "Пока нет вызванных талонов" : "No tickets called yet";
  const NEXT_LBL = lang === "uz" ? "Keyingi chiptalar" : lang === "ru" ? "Следующие талоны" : "Next tickets";
  const branchName = branch
    ? loc(branch as unknown as Record<string, unknown>, "name", lang) || branch.name_uz
    : "Qubit QMS";
  const visibleWaiting = waiting.slice(0, 8);

  // Clean public display layout: header, current call, and next tickets.
  return (
    <div
      className="h-screen w-screen overflow-hidden bg-[#f6f8fb] text-[#0f172a]"
      style={{ fontFamily: "Inter, 'Segoe UI', Arial, Helvetica, sans-serif" }}
    >
      <div className="flex h-full flex-col px-10 py-8">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 pb-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#0284c7] text-3xl font-black text-white shadow-sm">
              Q
            </div>
            <div className="min-w-0">
              <div className="truncate text-3xl font-black tracking-tight">{branchName}</div>
              <div className="mt-1 text-base font-medium text-slate-500">Qubit QMS</div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div>
              <div className="text-5xl font-black tabular-nums tracking-tight">{timeStr}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">{dateStr}</div>
            </div>
            <div className="flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold transition ${
                    lang === l.code ? "bg-[#0284c7] text-white" : "text-slate-500"
                  }`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[1.2fr_0.8fr] gap-8 py-8">
          <section className="flex min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black uppercase tracking-[0.22em] text-[#0284c7]">{SERVING_LBL}</div>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">
                {W}
              </div>
            </div>

            {latest ? (
              <div className="grid min-h-0 flex-1 place-items-center text-center">
                <div>
                  <div className="text-[15vw] font-black leading-none tracking-tight text-slate-950">
                    {latest.ticket_number}
                  </div>
                  <div className="mt-8 inline-flex items-center gap-5 rounded-3xl bg-[#e0f2fe] px-10 py-6 text-[#075985]">
                    <span className="text-3xl font-black uppercase">{GO_LBL}</span>
                    <span className="text-7xl font-black leading-none">{getWindow(latest)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid flex-1 place-items-center text-center text-slate-400">
                <div>
                  <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-4xl font-black text-slate-300">
                    Q
                  </div>
                  <div className="text-3xl font-bold">{EMPTY_LBL}</div>
                </div>
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-col rounded-[28px] border border-slate-200 bg-[#0f172a] p-6 text-white shadow-sm">
            <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.22em] text-sky-300">{NEXT_LBL}</div>
                <div className="mt-1 text-3xl font-black">{WAITING_LBL}</div>
              </div>
              <div className="text-4xl font-black tabular-nums text-white/50">{visibleWaiting.length}</div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-hidden">
              {visibleWaiting.length > 0 ? visibleWaiting.map((ticket, index) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-sm font-black text-white/60">
                      {index + 1}
                    </div>
                    <div className="text-4xl font-black tracking-wide">{ticket.ticket_number}</div>
                  </div>
                  <div className="max-w-48 truncate text-right text-sm font-semibold text-white/50">
                    {ticket.queue_group ? loc(ticket.queue_group as unknown as Record<string, unknown>, "name", lang) || ticket.queue_group.name_uz : ""}
                  </div>
                </div>
              )) : (
                <div className="grid h-full place-items-center text-center text-white/35">
                  <div>
                    <div className="text-6xl font-black">0</div>
                    <div className="mt-2 text-lg font-semibold">{WAITING_LBL}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {announced && (
          <div className="pointer-events-none fixed inset-0 grid place-items-center bg-[#0f172a]/80 backdrop-blur-sm">
            <div className="rounded-[36px] bg-white px-16 py-12 text-center shadow-2xl">
              <div className="text-lg font-black uppercase tracking-[0.22em] text-[#0284c7]">{SERVING_LBL}</div>
              <div className="mt-4 text-[12rem] font-black leading-none text-slate-950">{announced.ticket_number}</div>
              <div className="mt-6 text-5xl font-black text-slate-700">
                {W} {announced.counter_number ?? announced.counter_name}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
