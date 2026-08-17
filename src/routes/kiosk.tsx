import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queuesApi, branchesApi, menusApi, type Ticket, type QueueGroup, type Menu } from "@/lib/api";
import { useLang, LANGS, loc } from "@/lib/i18n";
import { useRealtime } from "@/hooks/use-realtime";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { Ticket as TicketIcon, Clock, Hash, Printer, ChevronLeft, ChevronRight, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  printTicketReceipt,
  estimateWaitMinutes,
} from "@/lib/queue-helpers";
import { ClientOnly } from "@/components/ClientOnly";

export const Route = createFileRoute("/kiosk")({
  head: () => ({ meta: [{ title: "Kiosk — Qubit QMS" }] }),
  component: () => (
    <ClientOnly
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      }
    >
      <KioskPage />
    </ClientOnly>
  ),
});

function KioskPage() {
  const { lang, setLang, t } = useLang();
  const qc = useQueryClient();
  const [branchId, setBranchId] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [kioskTheme, setKioskTheme] = useState<"dark" | "light">("dark");
  const isDark = kioskTheme !== "light";

  // issued ticket state
  const [issuedTicket, setIssuedTicket] = useState<Ticket | null>(null);
  const [countdown, setCountdown] = useState(6);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // menu navigation stack: [] = root, [id] = inside that menu item
  const [menuStack, setMenuStack] = useState<Menu[]>([]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const b = p.get("branch"); const d = p.get("device");
    if (b) setBranchId(b);
    if (d) setDeviceId(d);

    // Load settings — always check both sources so theme stays in sync
    // even when the admin updates settings from the KioskEditor
    void (async () => {
      try {
        let theme: string | null = null;

        // 1. Check device-specific settings (set by Electron poller or pairing)
        if (d) {
          const raw = localStorage.getItem(`paired_device_${d}`);
          if (raw) {
            const parsed = JSON.parse(raw) as { settings?: { theme?: string } };
            if (parsed.settings?.theme) theme = parsed.settings.theme;
          }
        }

        // 2. Always also check company-level settings (set by KioskEditor save)
        //    This ensures Chrome kiosk pages pick up theme changes immediately
        if (b) {
          const branch = await branchesApi.get(b).then((r) => r.data);
          if (branch?.company_id) {
            // Check localStorage first (fastest)
            const raw = localStorage.getItem(`kiosk_settings_${branch.company_id}`);
            if (raw) {
              const s = JSON.parse(raw) as { theme?: string; settings?: { theme?: string } };
              const t2 = s.theme ?? s.settings?.theme;
              if (t2) theme = t2; // company settings override device if both exist
            }
          }
        }

        if (theme) setKioskTheme(theme as "dark" | "light");
      } catch { /* ignore */ }
    })();

    // Listen for settings pushed by the Electron main process (device polling).
    // This lets the admin change theme/settings without needing a full page reload.
    const onSettingsChanged = (e: Event) => {
      const { settings } = (e as CustomEvent<{ deviceId: string; settings: Record<string, unknown> }>).detail;
      if (settings?.theme) setKioskTheme(settings.theme as "dark" | "light");
      // Invalidate menus and queues so any content changes appear immediately
      void qc.invalidateQueries({ queryKey: ["menus-kiosk"] });
      void qc.invalidateQueries({ queryKey: ["queues-kiosk"] });
    };
    window.addEventListener("qubit:settings-changed", onSettingsChanged);

    // Listen for KioskEditor saves on the same browser origin (storage event)
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

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: branch } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: () => branchesApi.get(branchId).then((r) => r.data),
    enabled: !!branchId,
    staleTime: 60_000,
  });

  // Menus (kiosk navigation tree)
  const { data: menus = [] } = useQuery({
    queryKey: ["menus-kiosk", branch?.company_id],
    queryFn: () => menusApi.list({ company_id: branch!.company_id! }).then((r) => r.data),
    enabled: !!branch?.company_id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // Flat queue list (shown when no menus, or as leaf targets)
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

  // WebSocket: refresh waiting counts when tickets are issued or called
  useRealtime({
    branchId,
    enabled: !!branchId,
    onTicketIssued: () => {
      void qc.invalidateQueries({ queryKey: ["tickets-waiting-kiosk", branchId] });
    },
    onTicketCalled: () => {
      void qc.invalidateQueries({ queryKey: ["tickets-waiting-kiosk", branchId] });
    },
  });

  const onlineQueues = (queues as QueueGroup[]).filter((q) => q.is_active);

  // ── Issue ticket ──────────────────────────────────────────────────────────
  const issueMutation = useMutation({
    mutationFn: (queueGroupId: string) =>
      queuesApi.issueTicket({ queue_group_id: queueGroupId, branch_id: branchId }).then((r) => r.data),
    onSuccess: (ticket) => {
      setIssuedTicket(ticket);
      setCountdown(6);
      const waitCount = waitingCountByGroup.get(ticket.queue_group_id) ?? 0;
      const estMins = estimateWaitMinutes(waitCount, (ticket.queue_group as QueueGroup | undefined)?.service?.estimated_time_mins);
      const counterName = ticket.counter
        ? loc(ticket.counter as unknown as Record<string, unknown>, "name", lang) || `#${(ticket.counter as { number?: number }).number ?? ""}`
        : undefined;
      printTicketReceipt({
        ticketNumber: ticket.ticket_number,
        queueName: loc(ticket.queue_group as unknown as Record<string, unknown>, "name", lang) || (ticket.queue_group as QueueGroup | undefined)?.name_uz || "Queue",
        counterName,
        position: waitCount + 1,
        estimatedWaitMins: estMins,
        branchName: loc(branch as unknown as Record<string, unknown>, "name", lang) || (branch as { name_uz?: string } | undefined)?.name_uz,
        logoUrl: (branch as any)?.company?.logo_media?.url ?? undefined,
        lang,
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to issue ticket"),
  });

  // Countdown after ticket issued
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

  // ── Theme helpers ─────────────────────────────────────────────────────────
  const bg   = isDark ? "bg-gradient-to-b from-slate-900 to-slate-800 text-white" : "bg-slate-50 text-slate-900";
  const card = isDark
    ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 shadow-lg hover:shadow-xl"
    : "border-slate-200 bg-white hover:border-blue-400 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.14)] hover:-translate-y-0.5";
  const muted= isDark ? "text-white/50" : "text-slate-400";

  // ── No branch ─────────────────────────────────────────────────────────────
  if (!branchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white px-6">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">📋</div>
          <h1 className="text-2xl font-bold">Kiosk not configured</h1>
          <p className="mt-3 text-white/60">Open with a branch ID:</p>
          <code className="mt-3 block rounded-xl bg-white/10 px-4 py-3 text-sm text-cyan-300">
            /kiosk?branch=&lt;branch_id&gt;
          </code>
        </div>
      </div>
    );
  }

  // ── Issued ticket thank-you screen ────────────────────────────────────────
  if (issuedTicket) {
    const waitCount = waitingCountByGroup.get(issuedTicket.queue_group_id) ?? 0;
    const estMins = estimateWaitMinutes(waitCount, (issuedTicket.queue_group as QueueGroup | undefined)?.service?.estimated_time_mins);
    return (
      <div className={`flex min-h-screen flex-col items-center justify-center px-6 py-12 ${bg}`}>
        {/* Lang */}
        <div className="absolute right-4 top-4 flex gap-1.5">
          {LANGS.map((l) => (
            <button key={l.code} onClick={() => setLang(l.code)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${lang === l.code ? (isDark ? "bg-white text-slate-900" : "bg-slate-900 text-white") : (isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-100 hover:bg-slate-200")}`}>
              {l.flag} {l.code.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm text-center">
          {/* Big number */}
          <div className={`mb-6 rounded-3xl p-10 shadow-2xl ${isDark ? "bg-white/10 backdrop-blur" : "border-2 border-slate-200 bg-white"}`}>
            <div className={`text-xs font-medium uppercase tracking-[0.3em] mb-2 ${muted}`}>{t("yourNumber")}</div>
            <div className={`text-[5rem] font-black leading-none tracking-wider`}>{issuedTicket.ticket_number}</div>
            <div className={`mt-3 text-base font-medium ${muted}`}>
              {loc(issuedTicket.queue_group as unknown as Record<string, unknown>, "name", lang) || (issuedTicket.queue_group as QueueGroup | undefined)?.name_uz}
            </div>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 ${isDark ? "bg-white/5" : "border bg-slate-50"}`}>
              <div className={`text-xs uppercase tracking-widest mb-1 ${muted}`}>{t("waitPosition")}</div>
              <div className="text-3xl font-black">{waitCount + 1}</div>
            </div>
            <div className={`rounded-2xl p-4 ${isDark ? "bg-white/5" : "border bg-slate-50"}`}>
              <div className={`text-xs uppercase tracking-widest mb-1 ${muted}`}>{t("estWaitTime")}</div>
              <div className="text-3xl font-black">{estMins != null ? `~${estMins}` : "—"}</div>
              {estMins != null && <div className={`text-xs ${muted}`}>{t("minutes")}</div>}
            </div>
          </div>

          {/* Re-print */}
          <Button variant="outline" className={`mb-4 w-full gap-2 ${isDark ? "border-white/20 text-white hover:bg-white/10" : ""}`}
            onClick={() => printTicketReceipt({
              ticketNumber: issuedTicket.ticket_number,
              queueName: loc(issuedTicket.queue_group as unknown as Record<string, unknown>, "name", lang) || (issuedTicket.queue_group as QueueGroup | undefined)?.name_uz || "Queue",
              position: waitCount + 1,
              estimatedWaitMins: estMins,
              branchName: loc(branch as unknown as Record<string, unknown>, "name", lang) || (branch as { name_uz?: string } | undefined)?.name_uz,
              lang,
            })}>
            <Printer className="h-4 w-4" /> {t("printTicket")}
          </Button>

          <button onClick={() => { setIssuedTicket(null); setMenuStack([]); }}
            className={`text-sm transition ${isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"}`}>
            {t("thanks")} — {t("issueAnother")} ({countdown}s)
          </button>
        </div>
      </div>
    );
  }

  // ── Determine current menu items to show ──────────────────────────────────
  const hasMenus = menus.filter((m) => m.is_visible).length > 0; = menuStack.length > 0 ? menuStack[menuStack.length - 1] : null;

  // Items at current level — either root or children of current parent
  const currentItems = hasMenus
    ? currentMenuParent
      // Children are nested on the parent object itself
      ? ((currentMenuParent as any).children ?? []).filter((m: Menu) => m.is_visible)
      // Root level
      : menus.filter((m) => m.is_visible && (m.parent_id ?? null) === null)
    : [];

  // Main render
  return (
    <div className={`relative flex flex-col min-h-screen overflow-hidden ${bg}`}>
      {/* Lang */}
      <div className="absolute right-4 top-4 z-10 flex gap-1.5">
        {LANGS.map((l) => (
          <button key={l.code} onClick={() => setLang(l.code)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${lang === l.code ? (isDark ? "bg-white text-slate-900" : "bg-slate-900 text-white") : (isDark ? "bg-white/10 hover:bg-white/20" : "bg-slate-100 hover:bg-slate-200")}`}>
            {l.flag} {l.code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Back button */}
      {menuStack.length > 0 && (
        <button
          onClick={() => setMenuStack((s) => s.slice(0, -1))}
          className={`absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
        >
          <ChevronLeft className="h-4 w-4" />
          {lang === "uz" ? "Orqaga" : lang === "ru" ? "Назад" : "Back"}
        </button>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col items-center pt-6 pb-4 px-6">
        <img
          src="/logo.png"
          alt="logo"
          className="mb-3"
          style={{ height: 80, width: "auto", objectFit: "contain" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {currentMenuParent ? (
          <h1 className="text-3xl font-black tracking-tight text-center">
            {loc(currentMenuParent as unknown as Record<string, unknown>, "name", lang)
              || loc(currentMenuParent as unknown as Record<string, unknown>, "label", lang)
              || currentMenuParent.label || currentMenuParent.name}
          </h1>
        ) : (
          <>
            <h1 className="text-4xl font-black tracking-tight text-center">{t("kioskTitle")}</h1>
            <p className={`mt-1 text-center text-lg ${muted}`}>{t("kioskSubtitle")}</p>
          </>
        )}
      </div>

      {/* ── CONTENT fills screen ── */}
      <div className="flex-1 px-6 pb-6 flex flex-col min-h-0 max-w-4xl mx-auto w-full">

        {/* ── MENU MODE ── */}
        {hasMenus && (
          <div className="grid grid-cols-2 gap-5 flex-1" style={{ alignContent: "start" }}>
            {currentItems.map((item) => {
              const isLeaf = !!item.queue_group_id;
              const queue = isLeaf ? onlineQueues.find((q) => q.id === item.queue_group_id) : null;
              const waitCount = queue ? (waitingCountByGroup.get(queue.id) ?? 0) : 0;
              const estMins = queue ? estimateWaitMinutes(waitCount, queue.service?.estimated_time_mins) : null;

              const itemName = isLeaf && queue
                ? (loc(queue as unknown as Record<string, unknown>, "name", lang) || queue.name_uz)
                : (loc(item as unknown as Record<string, unknown>, "name", lang)
                    || loc(item as unknown as Record<string, unknown>, "label", lang)
                    || item.label || item.name);

              return (
                <button
                  key={item.id}
                  disabled={issueMutation.isPending}
                  onClick={() => {
                    if (isLeaf && item.queue_group_id) {
                      issueMutation.mutate(item.queue_group_id);
                    } else {
                      setMenuStack((s) => [...s, item]);
                    }
                  }}
                  className={`group flex flex-col rounded-3xl border p-8 text-left transition active:scale-[0.98] disabled:opacity-50 ${card}`}
                >
                  <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isLeaf ? (isDark ? "bg-green-500/20 text-green-400" : "bg-green-50 text-green-600") : (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600")}`}>
                    {isLeaf ? <TicketIcon className="h-7 w-7" /> : <FolderOpen className="h-7 w-7" />}
                  </div>
                  <div className="text-3xl font-bold flex-1 leading-snug">{itemName}</div>
                  {isLeaf && queue && (
                    <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg ${muted}`}>
                      <span className="flex items-center gap-1.5"><Clock className="h-5 w-5" />{waitCount} {lang === "uz" ? "kutmoqda" : lang === "ru" ? "ожидают" : "waiting"}</span>
                      {estMins != null && <span className={`font-semibold ${isDark ? "text-cyan-400" : "text-primary"}`}>~{estMins} {t("minutes")}</span>}
                    </div>
                  )}
                  {!isLeaf && (item.children?.length ?? 0) > 0 && (
                    <div className={`mt-3 flex items-center gap-1 text-lg ${muted}`}>
                      {item.children!.length} {lang === "uz" ? "ta xizmat" : lang === "ru" ? "услуги" : "services"}
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  )}
                </button>
              );
            })}
            {currentItems.length === 0 && (
              <div className={`col-span-2 rounded-2xl border p-10 text-center ${isDark ? "border-white/10" : "border-slate-200"} ${muted}`}>
                {lang === "uz" ? "Bu bo'limda xizmat yo'q" : lang === "ru" ? "В этом разделе нет услуг" : "No services in this section"}
              </div>
            )}
          </div>
        )}

        {/* ── FLAT QUEUE MODE ── */}
        {!hasMenus && (
          onlineQueues.length === 0 ? (
            <div className={`rounded-2xl border p-10 text-center ${isDark ? "border-white/10" : "border-slate-200"} ${muted}`}>
              {t("noQueues")}
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-5 flex-1" style={{ alignContent: "start" }}>
              {onlineQueues.map((q) => {
                const waitCount = waitingCountByGroup.get(q.id) ?? 0;
                const estMins = estimateWaitMinutes(waitCount, q.service?.estimated_time_mins);
                return (
                  <button
                    key={q.id}
                    disabled={issueMutation.isPending}
                    onClick={() => issueMutation.mutate(q.id)}
                    className={`group flex flex-col rounded-3xl border p-8 text-left transition active:scale-[0.98] disabled:opacity-50 ${card}`}
                  >
                    <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"}`}>
                      <TicketIcon className="h-7 w-7" />
                    </div>
                    <div className="text-3xl font-bold flex-1 leading-snug">{loc(q as unknown as Record<string, unknown>, "name", lang)}</div>
                    {q.service && (
                      <div className={`mt-1 text-lg ${muted}`}>
                        {loc(q.service as unknown as Record<string, unknown>, "description", lang) || loc(q.service as unknown as Record<string, unknown>, "name", lang)}
                      </div>
                    )}
                    <div className={`mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg ${muted}`}>
                      <span className="flex items-center gap-1.5"><Hash className="h-5 w-5" />{q.prefix}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-5 w-5" />{waitCount} {lang === "uz" ? "kutmoqda" : lang === "ru" ? "ожидают" : "waiting"}</span>
                      {estMins != null && <span className={`font-semibold ${isDark ? "text-cyan-400" : "text-primary"}`}>~{estMins} {t("minutes")}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
