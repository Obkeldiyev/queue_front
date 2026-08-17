import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queuesApi, branchesApi, menusApi, type Ticket, type QueueGroup, type Menu } from "@/lib/api";
import { useLang, LANGS, loc } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { printTicketReceipt, estimateWaitMinutes } from "@/lib/queue-helpers";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/kiosk")({
  head: () => ({ meta: [{ title: "Kiosk — Qubit QMS" }] }),
  component: () => (
    <ClientOnly
      fallback={
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#07111f" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(255,255,255,.15)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />
        </div>
      }
    >
      <KioskPage />
    </ClientOnly>
  ),
});

// ── Auto-reset timer hook ──────────────────────────────────────────────────
function useIdleReset(enabled: boolean, seconds: number, onReset: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onReset, seconds * 1000);
    };
    const events = ["click", "touchstart", "keydown"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset(); // start timer immediately
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [enabled, seconds, onReset]);
}

function KioskPage() {
  const { lang, setLang, t } = useLang();
  const qc = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [kioskTheme, setKioskTheme] = useState<"dark" | "light">("dark");
  const isDark = kioskTheme !== "light";
  const [now, setNow] = useState(new Date());

  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);
  const [countdown, setCountdown] = useState(8);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [menuStack, setMenuStack] = useState<Menu[]>([]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-reset to root after 35s of inactivity when inside a submenu
  useIdleReset(
    menuStack.length > 0 && !issuedTicket,
    35,
    () => setMenuStack([])
  );

  // Bootstrap
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const b = p.get("branch"); const d = p.get("device");
    if (b) setBranchId(b);
    if (d) setDeviceId(d);

    void (async () => {
      try {
        let theme: string | null = null;
        if (d) {
          const raw = localStorage.getItem(`paired_device_${d}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { settings?: { theme?: string } };
            if (parsed.settings?.theme) theme = parsed.settings.theme;
          }
        }
        if (b) {
          const branch = await branchesApi.get(b).then((r) => r.data);
          if (branch?.company_id) {
            const raw = localStorage.getItem(`kiosk_settings_${branch.company_id}`);
            if (raw) {
              const s = JSON.parse(raw) as { theme?: string; settings?: { theme?: string } };
              const t2 = s.theme ?? s.settings?.theme;
              if (t2) theme = t2;
            }
          }
        }
        if (theme) setKioskTheme(theme as "dark" | "light");
      } catch { /* ignore */ }
    })();

    const onSettingsChanged = (e: Event) => {
      const { settings } = (e as CustomEvent<{ deviceId: string; settings: Record<string, unknown> }>).detail;
      if (settings?.theme) setKioskTheme(settings.theme as "dark" | "light");
      void qc.invalidateQueries({ queryKey: ["menus-kiosk"] });
      void qc.invalidateQueries({ queryKey: ["queues-kiosk"] });
    };
    window.addEventListener("qubit:settings-changed", onSettingsChanged);
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.startsWith("kiosk_settings_") || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue) as { theme?: string };
        if (s.theme) setKioskTheme(s.theme as "dark" | "light");
      } catch { /* ignore */ }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("qubit:settings-changed", onSettingsChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [qc]);

  const { data: branch } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: () => branchesApi.get(branchId).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  const { data: menus = [] } = useQuery({
    queryKey: ["menus-kiosk", branch?.company_id],
    queryFn: () => menusApi.list({ company_id: branch!.company_id! }).then((r) => r.data),
    enabled: !!branch?.company_id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: queues = [] } = useQuery({
    queryKey: ["queues-kiosk", branchId],
    queryFn: () => queuesApi.list({ branch_id: branchId, is_active: "true" }).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const { data: waitingTickets = [] } = useQuery({
    queryKey: ["tickets-waiting-kiosk", branchId],
    queryFn: () => queuesApi.listTickets({ branch_id: branchId, status: "WAITING", limit: "200" }).then((r) => r.data),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  const waitingCountByGroup = new Map<string, number>();
  (waitingTickets as Ticket[]).forEach((tk) => {
    waitingCountByGroup.set(tk.queue_group_id, (waitingCountByGroup.get(tk.queue_group_id) ?? 0) + 1);
  });

  useRealtime({
    branchId, enabled: !!branchId,
    onTicketIssued: () => void qc.invalidateQueries({ queryKey: ["tickets-waiting-kiosk", branchId] }),
    onTicketCalled: () => void qc.invalidateQueries({ queryKey: ["tickets-waiting-kiosk", branchId] }),
  });

  const onlineQueues = (queues as QueueGroup[]).filter((q) => q.is_active);

  const issueMutation = useMutation({
    mutationFn: (queueGroupId: string) =>
      queuesApi.issueTicket({ queue_group_id: queueGroupId, branch_id: branchId }).then((r) => r.data),
    onSuccess: (ticket) => {
      setIssuedTicket(ticket);
      setCountdown(8);
      const waitCount = waitingCountByGroup.get(ticket.queue_group_id) ?? 0;
      const estMins = estimateWaitMinutes(waitCount, (ticket.queue_group as QueueGroup | undefined)?.service?.estimated_time_mins);
      printTicketReceipt({
        ticketNumber: ticket.ticket_number,
        queueName: loc(ticket.queue_group as unknown as Record<string, unknown>, "name", lang) || (ticket.queue_group as QueueGroup | undefined)?.name_uz || "Queue",
        position: waitCount + 1,
        estimatedWaitMins: estMins,
        branchName: loc(branch as unknown as Record<string, unknown>, "name", lang) || (branch as { name_uz?: string } | undefined)?.name_uz,
        logoUrl: (branch as any)?.company?.logo_media?.url ?? undefined,
        lang,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to issue ticket"),
  });

  useEffect(() => {
    if (!issuedTicket) return;
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current!);
          setIssuedTicket(null);
          setMenuStack([]);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [issuedTicket]);

  // ── Colors ───────────────────────────────────────────────────────────────
  const BG          = "#003675";   // Turin blue hsl(212,100%,23%) — main background
  const HEADER      = "#1a56db";   // lighter bright blue — header bar
  const CARD_BG     = "#ffffff";   // pure white cards
  const CARD_BORDER = "rgba(255,255,255,.3)";
  const CARD_TEXT   = "#003675";   // same blue text on cards
  const TITLE_COLOR = "#ffffff";   // white title
  const FOOTER_BG   = "#1a56db";   // same lighter blue — footer bar
  const LANG_ACTIVE = "#2563eb";
  const LANG_ACTIVE_TEXT = "#ffffff";
  const LANG_INACTIVE = "transparent";
  const LANG_INACTIVE_TEXT = "rgba(255,255,255,.6)";

  // ── Date / time ───────────────────────────────────────────────────────────
  const timeStr = now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });

  // ── No branch ─────────────────────────────────────────────────────────────
  if (!branchId) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#07111f", color: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h1 style={{ fontSize: 24, fontWeight: 900 }}>Kiosk not configured</h1>
          <p style={{ marginTop: 12, color: "#64748b" }}>Open with a branch ID: /kiosk?branch=...</p>
        </div>
      </div>
    );
  }

  // ── Ticket issued screen ───────────────────────────────────────────────────
  if (issuedTicket) {
    const waitCount = waitingCountByGroup.get(issuedTicket.queue_group_id) ?? 0;
    const estMins = estimateWaitMinutes(waitCount, (issuedTicket.queue_group as QueueGroup | undefined)?.service?.estimated_time_mins);
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, color: TITLE_COLOR, fontFamily: "Arial, Helvetica, sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: HEADER, padding: "14px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt="logo" style={{ height: 44, objectFit: "contain" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div style={{ display: "flex", gap: 6, background: "rgba(255,255,255,.08)", borderRadius: 999, padding: 4 }}>
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "6px 14px", background: lang === l.code ? LANG_ACTIVE : LANG_INACTIVE, color: lang === l.code ? LANG_ACTIVE_TEXT : LANG_INACTIVE_TEXT, fontWeight: 900, fontSize: 13 }}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
          <div style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}`, borderRadius: 28, padding: "48px 40px", textAlign: "center", maxWidth: 400, width: "100%" }}>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.2em", color: "#64748b", textTransform: "uppercase", marginBottom: 8 }}>{t("yourNumber")}</p>
            <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, color: CARD_TEXT, letterSpacing: 4 }}>{issuedTicket.ticket_number}</div>
            <p style={{ marginTop: 12, fontSize: 18, color: "#64748b" }}>{loc(issuedTicket.queue_group as unknown as Record<string, unknown>, "name", lang) || (issuedTicket.queue_group as QueueGroup | undefined)?.name_uz}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
              <div style={{ background: isDark ? "rgba(255,255,255,.05)" : "#f8fafc", borderRadius: 16, padding: 16 }}>
                <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("waitPosition")}</p>
                <p style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{waitCount + 1}</p>
              </div>
              <div style={{ background: isDark ? "rgba(255,255,255,.05)" : "#f8fafc", borderRadius: 16, padding: 16 }}>
                <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("estWaitTime")}</p>
                <p style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{estMins != null ? `~${estMins}` : "—"}</p>
                {estMins != null && <p style={{ fontSize: 12, color: "#64748b" }}>{t("minutes")}</p>}
              </div>
            </div>

            <Button variant="outline" style={{ marginTop: 24, width: "100%" }}
              onClick={() => printTicketReceipt({
                ticketNumber: issuedTicket.ticket_number,
                queueName: loc(issuedTicket.queue_group as unknown as Record<string, unknown>, "name", lang) || (issuedTicket.queue_group as QueueGroup | undefined)?.name_uz || "Queue",
                position: waitCount + 1, estimatedWaitMins: estMins,
                branchName: loc(branch as unknown as Record<string, unknown>, "name", lang) || (branch as { name_uz?: string } | undefined)?.name_uz, lang,
              })}>
              <Printer style={{ width: 16, height: 16, marginRight: 8 }} /> {t("printTicket")}
            </Button>

            <button onClick={() => { setIssuedTicket(null); setMenuStack([]); }}
              style={{ marginTop: 16, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 14 }}>
              {t("thanks")} — {t("issueAnother")} ({countdown}s)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ background: FOOTER_BG, padding: "18px 32px", textAlign: "center", borderRadius: 16 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc", letterSpacing: 2 }}>{dateStr} {timeStr}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Menu items ─────────────────────────────────────────────────────────────
  const hasMenus = menus.filter((m) => m.is_visible).length > 0;
  const currentMenuParent = menuStack.length > 0 ? menuStack[menuStack.length - 1] : null;
  const currentItems: Menu[] = hasMenus
    ? currentMenuParent
      ? ((currentMenuParent as any).children ?? []).filter((m: Menu) => m.is_visible)
      : menus.filter((m) => m.is_visible && (m.parent_id ?? null) === null)
    : [];

  const titleText = currentMenuParent
    ? (loc(currentMenuParent as unknown as Record<string, unknown>, "name", lang) || loc(currentMenuParent as unknown as Record<string, unknown>, "label", lang) || currentMenuParent.label || currentMenuParent.name)
    : lang === "uz" ? "Yo'nalishni tanlang" : lang === "ru" ? "Выберите направление" : "Select Direction";

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: BG, fontFamily: "Arial, Helvetica, sans-serif", color: TITLE_COLOR }}>

      {/* ── HEADER ── */}
      <div style={{ padding: "16px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: HEADER, padding: "10px 16px", borderRadius: menuStack.length > 0 ? "16px 16px 0 0" : 16 }}>
          {/* Logo or back button */}
          {menuStack.length > 0 ? (
            <button
              onClick={() => setMenuStack((s) => s.slice(0, -1))}
              style={{
                border: "none", cursor: "pointer",
                background: "rgba(0,0,0,.2)",
                borderRadius: 999,
                color: "#ffffff", padding: "5px 14px",
                fontSize: 13, fontWeight: 800,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
              {lang === "uz" ? "Orqaga" : lang === "ru" ? "Назад" : "Back"}
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center" }}>
              <img src="/Logo Uzb Vertical (white).png" alt="Turin Politexnika Universiteti"
                style={{ height: 52, width: "auto", objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          {/* Language switcher */}
          <div style={{ display: "flex", gap: 2, alignItems: "center", background: "rgba(0,0,0,.2)", borderRadius: 999, padding: 3 }}>
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} style={{
                border: "none", cursor: "pointer", borderRadius: 999, padding: "5px 12px",
                background: lang === l.code ? "#ffffff" : "transparent",
                color: lang === l.code ? "#003675" : "rgba(255,255,255,.7)",
                fontWeight: 800, fontSize: 13,
              }}>
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {/* Back button continuation — seamless bottom strip */}
        {menuStack.length > 0 && (
          <div style={{ background: HEADER, borderRadius: "0 0 16px 16px", height: 6 }} />
        )}
      </div>

      {/* ── TITLE ── */}
      <div style={{ textAlign: "center", padding: "24px 24px 12px", flexShrink: 0 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "0.02em", color: TITLE_COLOR, margin: 0, textTransform: "uppercase" }}>
          {titleText}
        </h1>
        {currentMenuParent && (
          <p style={{ margin: "8px 0 0", fontSize: 18, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>
            {lang === "uz" ? "Xizmatni tanlang" : lang === "ru" ? "Выберите услугу" : "Select a service"}
          </p>
        )}
      </div>

      {/* ── CARDS GRID ── */}
      <div style={{ flex: 1, padding: "0 24px 24px", overflowY: "auto" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          maxWidth: 860,
          margin: "0 auto",
        }}>
          {(hasMenus ? currentItems : (onlineQueues as any[])).map((item: any) => {
            const isMenu = !!item.queue_group_id !== undefined && item.name !== undefined && item.label !== undefined;
            const isLeaf = hasMenus ? !!item.queue_group_id : true;
            const queue = hasMenus && isLeaf ? onlineQueues.find((q) => q.id === item.queue_group_id) : (hasMenus ? null : item);
            const queueGroupId = hasMenus ? item.queue_group_id : item.id;
            const waitCount = queue ? (waitingCountByGroup.get(queue.id) ?? 0) : 0;

            const itemName = hasMenus
              ? (isLeaf && queue
                ? (loc(queue as unknown as Record<string, unknown>, "name", lang) || queue.name_uz)
                : (loc(item as unknown as Record<string, unknown>, "name", lang) || loc(item as unknown as Record<string, unknown>, "label", lang) || item.label || item.name))
              : loc(item as unknown as Record<string, unknown>, "name", lang) || item.name_uz;

            return (
              <button
                key={item.id}
                disabled={issueMutation.isPending}
                onClick={() => {
                  if (!hasMenus || (hasMenus && isLeaf && queueGroupId)) {
                    issueMutation.mutate(hasMenus ? queueGroupId : item.id);
                  } else {
                    setMenuStack((s) => [...s, item]);
                  }
                }}
                style={{
                  background: CARD_BG,
                  border: `1.5px solid ${CARD_BORDER}`,
                  borderRadius: 20,
                  padding: "28px 24px",
                  cursor: issueMutation.isPending ? "not-allowed" : "pointer",
                  textAlign: "center",
                  color: CARD_TEXT,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 22,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  transition: "transform 0.1s, box-shadow 0.1s",
                  boxShadow: "0 4px 16px rgba(0,0,0,.15)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 120,
                  opacity: issueMutation.isPending ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}
              >
                <span>{itemName}</span>
                {(isLeaf || !hasMenus) && waitCount > 0 && (
                  <span style={{ marginTop: 8, fontSize: 14, fontWeight: 600, color: "#1a56db" }}>
                    {waitCount} {lang === "uz" ? "kutmoqda" : lang === "ru" ? "ожидают" : "waiting"}
                  </span>
                )}
              </button>
            );
          })}

          {hasMenus && currentItems.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#64748b", fontSize: 18 }}>
              {lang === "uz" ? "Bu bo'limda xizmat yo'q" : lang === "ru" ? "В этом разделе нет услуг" : "No services in this section"}
            </div>
          )}
          {!hasMenus && onlineQueues.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "#64748b", fontSize: 18 }}>
              {t("noQueues")}
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER — date/time ── */}
      <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
        <div style={{ background: FOOTER_BG, padding: "18px 32px", textAlign: "center", borderRadius: 16 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: "#f8fafc", letterSpacing: 3, fontVariantNumeric: "tabular-nums" }}>
            {dateStr} {timeStr}
          </span>
        </div>
      </div>
    </div>
  );
}
