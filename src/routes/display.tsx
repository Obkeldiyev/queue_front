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
        <div className="flex min-h-screen items-center justify-center bg-[#07111f]">
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

  useEffect(() => {
    const tm = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tm);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const b = p.get("branch");
    const d = p.get("device");
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
          const companyId = branch.company_id;
          const raw = localStorage.getItem(`kiosk_settings_${companyId}`);
          if (raw) {
            const s = JSON.parse(raw) as { displayTheme?: string; theme?: string; settings?: { displayTheme?: string; theme?: string } };
            const preferred = s.displayTheme ?? s.theme ?? s.settings?.displayTheme ?? s.settings?.theme;
            if (preferred) setDisplayTheme(preferred as "dark" | "light");
          }
          try {
            const comp = await companiesApi.get(companyId).then((r) => r.data);
            const s = comp?.settings as { displayTheme?: string; theme?: string } | undefined;
            const preferred = s?.displayTheme ?? s?.theme;
            if (preferred) setDisplayTheme(preferred as "dark" | "light");
          } catch { /* ignore */ }

          const onStorage = (e: StorageEvent) => {
            if (e.key !== `kiosk_settings_${companyId}` || !e.newValue) return;
            try {
              const s2 = JSON.parse(e.newValue) as { displayTheme?: string; theme?: string };
              const t2 = s2.displayTheme ?? s2.theme;
              if (t2) setDisplayTheme(t2 as "dark" | "light");
            } catch { /* ignore */ }
          };
          window.addEventListener("storage", onStorage);
          (window as any).__displayStorageCleanup = () => window.removeEventListener("storage", onStorage);
        }
      } catch { /* ignore */ }
    })();

    return () => {
      try { (window as any).__displayStorageCleanup?.(); } catch { /* ignore */ }
    };
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
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, status: "WAITING", limit: "30" }).then((r) => r.data),
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

  // Map counter_id → ticket for serving rows
  const counterTicketMap = new Map<string, Ticket>();
  (calledTickets as Ticket[]).forEach((t) => { if (t.counter_id) counterTicketMap.set(t.counter_id, t); });

  const getCounter = (id?: string): Counter | undefined =>
    (counters as Counter[]).find((c) => c.id === id);

  // Build serving rows: each counter that has an active session gets a row
  // Sort by counter number ascending
  const servingRows = (calledTickets as Ticket[])
    .filter((t) => t.counter_id)
    .sort((a, b) => {
      const ca = getCounter(a.counter_id)?.number ?? 99;
      const cb = getCounter(b.counter_id)?.number ?? 99;
      return ca - cb;
    })
    .slice(0, 8);

  const waiting = [...(waitingTickets as Ticket[])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(0, 18);

  const timeStr = now.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });

  // Labels
  const SERVING_LBL = lang === "uz" ? "XIZMAT KO'RSATILMOQDA" : lang === "ru" ? "ОБСЛУЖИВАЕТСЯ" : "NOW SERVING";
  const WAITING_LBL = lang === "uz" ? "KUTILMOQDA" : lang === "ru" ? "ОЖИДАНИЕ" : "WAITING";
  const WINDOW_LBL  = lang === "uz" ? "OYNAGA"    : lang === "ru" ? "КАБИНЕТ"  : "WINDOW";
  const EMPTY_LBL   = lang === "uz" ? "Hozircha chaqirilgan chipta yo'q" : lang === "ru" ? "Нет вызванных талонов" : "No tickets called yet";

  const branchName = branch
    ? loc(branch as unknown as Record<string, unknown>, "name", lang) || (branch as any).name_uz
    : "Qubit QMS";

  const logoUrl = (branch as any)?.company?.logo_media?.url;

  // Theme colours
  const bg      = isDark ? "#07111f" : "#f1f5f9";
  const headerBg= isDark ? "#0d1b2f" : "#1e293b";
  const leftBg  = isDark ? "rgba(241,245,249,0.06)" : "#e0f2fe";
  const leftBorder = isDark ? "rgba(148,163,184,.15)" : "#bae6fd";
  const rightBg = isDark ? "#0d1b2f" : "#1e293b";
  const ticketBg= isDark ? "#162032" : "#1e3a5f";
  const windowBg= isDark ? "#0ea5e9" : "#0284c7";
  const waitGrid= isDark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.15)";
  const textMain= isDark ? "#f8fafc" : "#f8fafc";
  const textLeft= isDark ? "#0f172a" : "#0f172a";

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", background: bg, color: textMain, fontFamily: "Inter, Segoe UI, Arial, sans-serif" }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px 24px 24px", gap: 16 }}>

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: headerBg, borderRadius: 20, padding: "14px 24px",
          border: "1px solid rgba(148,163,184,.12)",
          flexShrink: 0,
        }}>
          {/* Left: logo + org */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            {logoUrl ? (
              <img src={logoUrl.startsWith("http") ? logoUrl : `https://xnavbat.polito.uz${logoUrl}`}
                alt="logo" style={{ width: 52, height: 52, borderRadius: 12, objectFit: "contain", background: "#fff", padding: 4, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 52, height: 52, borderRadius: 12, background: "#0ea5e9", display: "grid", placeItems: "center", fontSize: 26, fontWeight: 900, flexShrink: 0 }}>Q</div>
            )}
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2, color: "#f8fafc" }}>{branchName}</div>
              <div style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600, marginTop: 2 }}>Qubit QMS</div>
            </div>
          </div>

          {/* Center: system name */}
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase" }}>
            XNAVBAT QUEUE SYSTEM
          </div>

          {/* Right: clock + lang */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: "#f8fafc" }}>
              {timeStr}
            </div>
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.08)", borderRadius: 999, padding: 4 }}>
              {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLang(l.code)} style={{
                  border: 0, cursor: "pointer", borderRadius: 999, padding: "6px 12px",
                  background: lang === l.code ? "#e0f2fe" : "transparent",
                  color: lang === l.code ? "#0369a1" : "#94a3b8",
                  fontWeight: 900, fontSize: 13,
                }}>
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* ── MAIN PANELS ─────────────────────────────────────────── */}
        <main style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, flex: 1, minHeight: 0 }}>

          {/* LEFT — SERVING */}
          <section style={{
            background: leftBg, border: `1.5px solid ${leftBorder}`,
            borderRadius: 24, padding: "24px 28px", display: "flex", flexDirection: "column",
            minHeight: 0,
          }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.1em", color: "#0369a1", marginBottom: 20 }}>
              {SERVING_LBL}
            </div>

            {servingRows.length === 0 ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#94a3b8", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{EMPTY_LBL}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, overflow: "hidden" }}>
                {servingRows.map((ticket) => {
                  const counter = getCounter(ticket.counter_id);
                  const counterLabel = counter?.number
                    ? `${counter.number}-${WINDOW_LBL}`
                    : (counter ? (loc(counter as unknown as Record<string, unknown>, "name", lang) || counter.name_uz) : "");
                  return (
                    <div key={ticket.id} style={{
                      display: "flex", alignItems: "center", gap: 16,
                      background: "rgba(255,255,255,.55)", borderRadius: 18,
                      padding: "14px 20px",
                      backdropFilter: "blur(8px)",
                    }}>
                      {/* Ticket number */}
                      <div style={{
                        background: ticketBg, color: "#f8fafc", borderRadius: 14,
                        padding: "10px 22px", fontSize: 32, fontWeight: 900,
                        letterSpacing: "0.04em", flexShrink: 0, minWidth: 110, textAlign: "center",
                      }}>
                        {ticket.ticket_number}
                      </div>

                      {/* Arrow */}
                      <div style={{ fontSize: 28, fontWeight: 900, color: "#0369a1", flexShrink: 0 }}>›</div>

                      {/* Window */}
                      <div style={{
                        flex: 1, background: windowBg, color: "#fff", borderRadius: 14,
                        padding: "10px 22px", fontSize: 28, fontWeight: 900,
                        textAlign: "center", textTransform: "uppercase",
                      }}>
                        {counterLabel}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT — WAITING */}
          <section style={{
            background: rightBg, border: "1px solid rgba(148,163,184,.12)",
            borderRadius: 24, padding: "24px 28px", display: "flex", flexDirection: "column",
            minHeight: 0,
          }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.1em", color: "#38bdf8" }}>
                {WAITING_LBL}
              </div>
              <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: "#64748b" }}>
                {waiting.length}
              </div>
            </div>

            {/* 3-column grid */}
            {waiting.length === 0 ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#64748b", textAlign: "center" }}>
                <div style={{ fontSize: 52, fontWeight: 900 }}>0</div>
              </div>
            ) : (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
                flex: 1, overflow: "hidden", alignContent: "start",
              }}>
                {waiting.map((ticket) => (
                  <div key={ticket.id} style={{
                    background: waitGrid, borderRadius: 16,
                    display: "grid", placeItems: "center",
                    padding: "16px 8px",
                    fontSize: 28, fontWeight: 900, letterSpacing: "0.03em",
                    color: "#f8fafc",
                  }}>
                    {ticket.ticket_number}
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ── ANNOUNCEMENT OVERLAY ────────────────────────────────── */}
      {announced && (
        <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "rgba(2,6,23,.88)", backdropFilter: "blur(10px)", zIndex: 100 }}>
          <div style={{ borderRadius: 44, background: "#f8fafc", color: "#06111f", padding: "56px 80px", textAlign: "center", boxShadow: "0 30px 120px rgba(0,0,0,.5)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "0.14em", color: "#0284c7", textTransform: "uppercase" }}>{SERVING_LBL}</div>
            <div style={{ marginTop: 16, fontSize: 180, lineHeight: 0.9, fontWeight: 950, letterSpacing: "0.02em" }}>{announced.ticket_number}</div>
            <div style={{ marginTop: 28, fontSize: 52, fontWeight: 900, color: "#334155" }}>
              {announced.counter_number ?? ""} {WINDOW_LBL.split(" ")[0]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
