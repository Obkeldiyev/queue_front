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

  const servingCards = serving.slice(0, 4);

  // High-contrast public display layout.
  return (
    <div style={{
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      background: "#07111f",
      color: "#f8fafc",
      fontFamily: "Inter, Segoe UI, Arial, sans-serif",
    }}>
      <div style={{ display: "flex", height: "100%", flexDirection: "column", padding: 32, gap: 24 }}>
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderRadius: 28,
          background: "#0d1b2f",
          border: "1px solid rgba(148,163,184,.18)",
          boxShadow: "0 18px 60px rgba(0,0,0,.22)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              display: "grid",
              placeItems: "center",
              background: "#0ea5e9",
              color: "white",
              fontSize: 34,
              fontWeight: 900,
              flexShrink: 0,
            }}>Q</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {branchName}
              </div>
              <div style={{ marginTop: 8, color: "#93a4b8", fontSize: 18, fontWeight: 700 }}>Qubit QMS</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 58, lineHeight: 1, fontWeight: 950, fontVariantNumeric: "tabular-nums" }}>{timeStr}</div>
              <div style={{ marginTop: 8, color: "#93a4b8", fontSize: 16, fontWeight: 700 }}>{dateStr}</div>
            </div>
            <div style={{ display: "flex", gap: 6, padding: 6, borderRadius: 999, background: "rgba(255,255,255,.06)" }}>
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: "10px 14px",
                    background: lang === l.code ? "#e0f2fe" : "transparent",
                    color: lang === l.code ? "#075985" : "#94a3b8",
                    fontWeight: 900,
                  }}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", gap: 24, minHeight: 0, flex: 1 }}>
          <section style={{
            minHeight: 0,
            borderRadius: 34,
            background: "linear-gradient(180deg,#f8fafc 0%,#e0f2fe 100%)",
            color: "#06111f",
            padding: 36,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 80px rgba(0,0,0,.3)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 22, fontWeight: 950, letterSpacing: ".12em", color: "#0369a1" }}>{SERVING_LBL}</div>
              <div style={{ borderRadius: 999, background: "#dbeafe", padding: "12px 18px", color: "#075985", fontSize: 18, fontWeight: 950 }}>{W}</div>
            </div>

            <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", minHeight: 0 }}>
              {latest ? (
                <div>
                  <div style={{ fontSize: "clamp(150px, 19vw, 330px)", lineHeight: .86, fontWeight: 950, letterSpacing: "-.04em" }}>
                    {latest.ticket_number}
                  </div>
                  <div style={{
                    marginTop: 36,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 28,
                    borderRadius: 30,
                    background: "#075985",
                    color: "white",
                    padding: "22px 34px",
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 950, textTransform: "uppercase" }}>{GO_LBL}</span>
                    <span style={{ fontSize: 82, lineHeight: 1, fontWeight: 950 }}>{getWindow(latest)}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: "#64748b" }}>
                  <div style={{ margin: "0 auto 22px", width: 84, height: 84, borderRadius: 24, display: "grid", placeItems: "center", background: "#e2e8f0", fontSize: 42, fontWeight: 950 }}>Q</div>
                  <div style={{ fontSize: 38, fontWeight: 950 }}>{EMPTY_LBL}</div>
                </div>
              )}
            </div>
          </section>

          <section style={{
            minHeight: 0,
            borderRadius: 34,
            background: "#0d1b2f",
            border: "1px solid rgba(148,163,184,.18)",
            padding: 28,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 24px 80px rgba(0,0,0,.22)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", paddingBottom: 20, borderBottom: "1px solid rgba(148,163,184,.18)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 950, letterSpacing: ".16em", color: "#38bdf8" }}>{NEXT_LBL}</div>
                <div style={{ marginTop: 6, fontSize: 40, fontWeight: 950 }}>{WAITING_LBL}</div>
              </div>
              <div style={{ color: "#64748b", fontSize: 52, lineHeight: 1, fontWeight: 950 }}>{visibleWaiting.length}</div>
            </div>

            <div style={{ flex: 1, overflow: "hidden", paddingTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {visibleWaiting.length > 0 ? visibleWaiting.map((ticket, index) => (
                <div key={ticket.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr auto", alignItems: "center", gap: 14, borderRadius: 22, padding: "16px 18px", background: "rgba(255,255,255,.065)" }}>
                  <div style={{ width: 42, height: 42, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(14,165,233,.16)", color: "#7dd3fc", fontWeight: 950 }}>{index + 1}</div>
                  <div style={{ fontSize: 42, lineHeight: 1, fontWeight: 950, letterSpacing: ".03em" }}>{ticket.ticket_number}</div>
                  <div style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#94a3b8", fontWeight: 800 }}>
                    {ticket.queue_group ? loc(ticket.queue_group as unknown as Record<string, unknown>, "name", lang) || ticket.queue_group.name_uz : ""}
                  </div>
                </div>
              )) : (
                <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#64748b", textAlign: "center" }}>
                  <div>
                    <div style={{ fontSize: 76, lineHeight: 1, fontWeight: 950 }}>0</div>
                    <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900 }}>{WAITING_LBL}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        {announced && (
          <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,6,23,.86)", backdropFilter: "blur(8px)" }}>
            <div style={{ borderRadius: 44, background: "#f8fafc", color: "#06111f", padding: "56px 76px", textAlign: "center", boxShadow: "0 30px 120px rgba(0,0,0,.45)" }}>
              <div style={{ fontSize: 20, fontWeight: 950, letterSpacing: ".16em", color: "#0284c7" }}>{SERVING_LBL}</div>
              <div style={{ marginTop: 18, fontSize: 190, lineHeight: .9, fontWeight: 950 }}>{announced.ticket_number}</div>
              <div style={{ marginTop: 28, fontSize: 62, fontWeight: 950, color: "#334155" }}>{W} {announced.counter_number ?? announced.counter_name}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
