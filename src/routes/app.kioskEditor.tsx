import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requireCompanyAdmin } from "@/lib/guards";
import { useAuthStore } from "@/lib/auth-store";
import { devicesApi, menusApi, api } from "@/lib/api";
import { CanvasDesigner, blankPage, type CanvasPage } from "@/components/qms/CanvasDesigner";
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
  const page = pages[pageName] || blankPage();
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
