import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queuesApi, countersApi, branchesApi, type Ticket, type Counter, companiesApi } from "@/lib/api";
import { useLang, LANGS, loc } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";
import { useEffect, useRef, useState } from "react";
import { buildDeviceLink } from "@/lib/queue-helpers";
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

  // Theme tokens
  const bg   = isDark ? "#050a14"                 : "#f1f5f9";
  const surf = isDark ? "rgba(255,255,255,0.04)"  : "#ffffff";
  const bord = isDark ? "rgba(255,255,255,0.07)"  : "rgba(0,0,0,0.1)";
  const t1   = isDark ? "rgba(255,255,255,0.92)"  : "#0f172a";
  const t2   = isDark ? "rgba(255,255,255,0.55)"  : "#475569";
  const t3   = isDark ? "rgba(255,255,255,0.25)"  : "#94a3b8";
  const div  = isDark ? "rgba(255,255,255,0.05)"  : "rgba(0,0,0,0.06)";
  const acBg = isDark ? "rgba(8,145,178,0.18)"    : "rgba(8,145,178,0.08)";
  const acBd = isDark ? "rgba(8,145,178,0.4)"     : "rgba(8,145,178,0.25)";
  const acN  = isDark ? "#22d3ee"                 : "#0e7490";
  const wF   = isDark ? "#fbbf24"                 : "#d97706";
  const wB   = isDark ? "rgba(245,158,11,0.08)"   : "rgba(245,158,11,0.06)";
  const wBd  = isDark ? "rgba(245,158,11,0.25)"   : "rgba(245,158,11,0.2)";

  // Simplified display layout: header + two-column table (ticket | window)
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white text-black" style={{ fontFamily: "'Segoe UI',Arial,Helvetica,sans-serif" }}>
      <div className="w-full max-w-5xl px-6">
        <div className="flex items-center justify-between py-6 border-b" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex items-center gap-4">
            <img src="/logo192.png" alt="logo" style={{ height: 64, width: 64, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Mirzo Ulug'bek</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Milliy universiteti</div>
            </div>
          </div>
          <div className="text-right">
            <div style={{ fontSize: 18, fontWeight: 800 }}>CHIPTA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OYNA</div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{dateStr} {timeStr}</div>
          </div>
        </div>

        <div className="mt-8 rounded-lg bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              {(serving.length > 0 ? serving.slice(0, 6) : waiting.slice(0, 6)).map((tk, i) => (
                <div key={tk.id} className="flex items-center justify-between py-4 px-6" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '0.06em' }}>{tk.ticket_number}</div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{tk.counter_id ? (getCounter(tk.counter_id)?.number ?? '') : ('' )}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {(serving.length > 0 ? serving.slice(6, 12) : waiting.slice(6, 12)).map((tk) => (
                <div key={tk.id} className="flex items-center justify-between py-4 px-6" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 36, fontWeight: 800 }}>{tk.ticket_number}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{tk.counter_id ? (getCounter(tk.counter_id)?.number ?? '') : ''}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
