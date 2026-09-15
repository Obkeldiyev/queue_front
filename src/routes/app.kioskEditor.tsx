import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requireCompanyAdmin } from "@/lib/guards";
import { useAuthStore } from "@/lib/auth-store";
import { devicesApi, menusApi, api } from "@/lib/api";
import { CanvasDesigner, type CanvasPage } from "@/components/qms/CanvasDesigner";
import { Button } from "@/components/ui/button";
import { useLang, loc } from "@/lib/i18n";
import { toast } from "sonner";
export const Route = createFileRoute("/app/kioskEditor")({
  beforeLoad: requireCompanyAdmin,
  component: Editor,
});

type MenuLike = {
  id: string;
  name: string;
  name_uz?: string;
  name_ru?: string;
  name_en?: string;
  children?: MenuLike[];
};


function starterPage(pageName: string, deviceType?: string): CanvasPage {
  const isDisplay = deviceType?.includes("DISPLAY") || pageName === "billboard";
  if (isDisplay) {
    return {
      width: 1920,
      height: 1080,
      background: "#eef5ff",
      blocks: [
        { id: "display-header", type: "text", x: 60, y: 45, width: 1120, height: 90, content: "{{branch_name}}", color: "#111827", background: "transparent", fontSize: 42 },
        { id: "display-time", type: "text", x: 1510, y: 38, width: 310, height: 95, content: "{{time}}", color: "#111827", background: "transparent", fontSize: 58 },
        { id: "display-called-title", type: "text", x: 80, y: 205, width: 760, height: 75, content: "Now serving", color: "#0369a1", background: "transparent", fontSize: 46 },
        { id: "display-called", type: "queue", x: 80, y: 310, width: 760, height: 620, content: "queue", color: "#ffffff", background: "#dff3ff", fontSize: 40 },
        { id: "display-waiting-title", type: "text", x: 1025, y: 205, width: 760, height: 75, content: "Waiting", color: "#38bdf8", background: "transparent", fontSize: 46 },
        { id: "display-waiting", type: "queue", x: 1025, y: 310, width: 820, height: 620, content: "queue", color: "#ffffff", background: "#1f2937", fontSize: 40 },
      ],
    };
  }
  if (pageName === "ticket") {
    return {
      width: 420,
      height: 620,
      background: "#ffffff",
      blocks: [
        { id: "ticket-title", type: "text", x: 30, y: 25, width: 360, height: 60, content: "{{branch_name}}", color: "#111827", background: "transparent", fontSize: 24 },
        { id: "ticket-number", type: "text", x: 40, y: 150, width: 340, height: 110, content: "{{ticket_number}}", color: "#000000", background: "transparent", fontSize: 58 },
        { id: "ticket-time", type: "text", x: 70, y: 285, width: 280, height: 50, content: "{{time}}", color: "#475569", background: "transparent", fontSize: 18 },
        { id: "ticket-note", type: "text", x: 40, y: 430, width: 340, height: 60, content: "Please wait for your number", color: "#111827", background: "transparent", fontSize: 20 },
      ],
    };
  }
  return {
    width: 1280,
    height: 800,
    background: "#f3f6fc",
    blocks: [
      { id: "kiosk-title", type: "text", x: 80, y: 55, width: 840, height: 80, content: "{{branch_name}}", color: "#0f172a", background: "transparent", fontSize: 42 },
      { id: "kiosk-help", type: "text", x: 80, y: 155, width: 720, height: 55, content: "Choose a service", color: "#475569", background: "transparent", fontSize: 28 },
      { id: "kiosk-services", type: "services", x: 80, y: 245, width: 1120, height: 470, content: "services", color: "#0f172a", background: "#ffffff", fontSize: 28 },
    ],
  };
}

function flattenMenus(items: MenuLike[], depth = 0): Array<MenuLike & { depth: number }> {
  return items.flatMap((item) => [
    { ...item, depth },
    ...flattenMenus(item.children || [], depth + 1),
  ]);
}

function Editor() {
  const { user } = useAuthStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const label = (en: string, ru: string, uz: string) =>
    lang === "ru" ? ru : lang === "uz" ? uz : en;
  const [id, setId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("device") || "",
  );
  const [pageName, setPageName] = useState("home");
  const [pages, setPages] = useState<Record<string, CanvasPage>>({});
  const [menu, setMenu] = useState("");
  const [theme, setTheme] = useState("light");
  const [ticket, setTicket] = useState("");
  const [dirty, setDirty] = useState(false);
  const { data: devices = [] } = useQuery({
    queryKey: ["devices", user?.company_id],
    queryFn: () => devicesApi.list().then((r) => r.data),
  });
  const device = devices.find((d) => d.id === id);
  const { data: menus = [] } = useQuery({
    queryKey: ["menus", user?.company_id],
    queryFn: () => menusApi.list({ company_id: user!.company_id! }).then((r) => r.data),
    enabled: !!user?.company_id,
  });
  const menuPages = flattenMenus(menus as MenuLike[]);
  const { data: templates = [] } = useQuery({
    queryKey: ["ticket-templates", user?.company_id],
    queryFn: () =>
      api.get<Array<{ id: string; name: string }>>("/ticket-templates").then((r) => r.data),
  });
  useEffect(() => {
    if (!device || dirty) return;
    const s = (device.settings || {}) as any;
    setPages(s.pages || {});
    setTheme(s.theme || "light");
    setMenu(s.menu_id || "");
    setTicket(s.ticket_template_id || "");
  }, [device, dirty]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () =>
      devicesApi.update(id, {
        settings: {
          ...(device?.settings || {}),
          pages,
          menu_id: menu || null,
          ticket_template_id: ticket || null,
          theme,
          displayTheme: theme,
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["devices"] });
      setDirty(false);
      toast.success(
        label("Device design saved", "Дизайн устройства сохранён", "Qurilma dizayni saqlandi"),
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const hasSavedPage = Boolean(pages[pageName]);
  const page = pages[pageName] || starterPage(pageName, device?.device_type);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/app/devices" className="text-sm text-primary">
            ← {label("Devices", "Устройства", "Qurilmalar")}
          </Link>
          <h1 className="text-2xl font-bold">
            {label("Device studio", "Студия устройства", "Qurilma studiyasi")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {label(
              "Select a device. Design each screen, then save to update it live.",
              "Выберите устройство, настройте экраны и сохраните изменения.",
              "Qurilmani tanlang, ekranlarni sozlang va saqlang.",
            )}
          </p>
        </div>
        <Button disabled={!id || !dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending
            ? "…"
            : label("Save to device", "Сохранить на устройство", "Qurilmaga saqlash")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <select
          aria-label="Device"
          className="rounded border bg-background p-2"
          value={id}
          onChange={(e) => {
            if (
              dirty &&
              !confirm(
                label(
                  "Discard unsaved changes?",
                  "Отменить несохранённые изменения?",
                  "Saqlanmagan o‘zgarishlar bekor qilinsinmi?",
                ),
              )
            )
              return;
            setDirty(false);
            setId(e.target.value);
            setPages({});
          }}
        >
          <option value="">
            {label("Choose device", "Выберите устройство", "Qurilmani tanlang")}
          </option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} · {d.device_type}
            </option>
          ))}
        </select>
        <select
          aria-label="Screen"
          className="rounded border bg-background p-2"
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
        >
          {["home", "ticket", "billboard"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          {menuPages.map((m) => (
            <option key={m.id} value={m.id}>
              {"- ".repeat(m.depth)}
              {loc(m as any, "name", lang) || m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Menu"
          className="rounded border bg-background p-2"
          value={menu}
          onChange={(e) => {
            setMenu(e.target.value);
            setDirty(true);
          }}
        >
          <option value="">{label("All menus", "Все меню", "Barcha menyular")}</option>
          {menuPages.map((m) => (
            <option key={m.id} value={m.id}>
              {"- ".repeat(m.depth)}
              {loc(m as any, "name", lang) || m.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Receipt template"
          className="rounded border bg-background p-2"
          value={ticket}
          onChange={(e) => {
            setTicket(e.target.value);
            setDirty(true);
          }}
        >
          <option value="">{label("Default receipt", "Стандартный чек", "Standart chek")}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Theme"
          className="rounded border bg-background p-2"
          value={theme}
          onChange={(e) => {
            setTheme(e.target.value);
            setDirty(true);
          }}
        >
          <option value="light">{label("Light", "Светлая", "Yorug‘")}</option>
          <option value="dark">{label("Dark", "Тёмная", "Qorong‘i")}</option>
        </select>
        <Link to="/app/menus" className="p-2 text-primary">
          {label("Edit menus", "Редактор меню", "Menyularni tahrirlash")}
        </Link>
        <Link to="/app/tickets" className="p-2 text-primary">
          {label("Receipt studio", "Редактор чеков", "Chek studiyasi")}
        </Link>
      </div>
      {device && (
        <>
          {!hasSavedPage && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card p-3 text-sm text-muted-foreground">
              <span>{label("This screen is using an editable starter layout. Save it to keep it on this device.", "Этот экран использует редактируемый стартовый макет. Сохраните его для устройства.", "Bu ekran tahrirlanadigan boshlang‘ich maketdan foydalanmoqda. Uni qurilmaga saqlang.")}</span>
              <Button variant="outline" size="sm" onClick={() => { setPages({ ...pages, [pageName]: page }); setDirty(true); }}>
                {label("Use this layout", "Использовать макет", "Bu maketni ishlatish")}
              </Button>
            </div>
          )}
          <CanvasDesigner
            key={`${id}:${pageName}`}
            value={page}
            onChange={(p) => {
              setPages({ ...pages, [pageName]: p });
              setDirty(true);
            }}
          />
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `/${device.device_type.includes("DISPLAY") ? "display" : "kiosk"}?branch=${device.branch_id}&device=${id}`,
                "_blank",
              )
            }
          >
            {label("Open live preview", "Открыть предпросмотр", "Ko‘rish")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {label(
              "Text variables: {{ticket_number}}, {{branch_name}}, {{time}}. An empty screen uses the standard layout.",
              "Переменные: {{ticket_number}}, {{branch_name}}, {{time}}. Пустой экран использует стандартный макет.",
              "O‘zgaruvchilar: {{ticket_number}}, {{branch_name}}, {{time}}. Bo‘sh ekran standart dizaynni ishlatadi.",
            )}
          </p>
        </>
      )}
    </div>
  );
}
