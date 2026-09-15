import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireCompanyAdmin } from "@/lib/guards";
import { api } from "@/lib/api";
import { CanvasDesigner, type CanvasPage } from "@/components/qms/CanvasDesigner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
export const Route = createFileRoute("/app/tickets")({
  beforeLoad: requireCompanyAdmin,
  component: Studio,
});
interface Template {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  layout: CanvasPage;
  is_default: boolean;
}
function Studio() {
  const { lang } = useLang();
  const label = (en: string, ru: string, uz: string) =>
    lang === "ru" ? ru : lang === "uz" ? uz : en;
  const qc = useQueryClient();
  const empty = () => ({
    name: "Receipt",
    width_mm: 80,
    height_mm: 150,
    layout: { width: 302, height: 567, background: "#ffffff", blocks: [] },
    is_default: false,
  });
  const [id, setId] = useState("");
  const [form, setForm] = useState<Omit<Template, "id">>(empty);
  const { data: templates = [] } = useQuery({
    queryKey: ["ticket-templates"],
    queryFn: () => api.get<Template[]>("/ticket-templates").then((r) => r.data),
  });
  const save = useMutation({
    mutationFn: () =>
      id
        ? api.patch(`/ticket-templates/${id}`, form)
        : api.post<Template>("/ticket-templates", form),
    onSuccess: (r) => {
      if (!id) setId((r.data as Template).id);
      void qc.invalidateQueries({ queryKey: ["ticket-templates"] });
      toast.success(label("Saved", "Сохранено", "Saqlandi"));
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/ticket-templates/${id}`),
    onSuccess: () => {
      setId("");
      setForm(empty());
      void qc.invalidateQueries({ queryKey: ["ticket-templates"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">
        {label("Receipt studio", "Редактор чеков", "Chek muharriri")}
      </h1>
      <p className="text-muted-foreground">
        {label(
          "Set paper size in millimetres. Drag text and photos into place. Variables: {{ticket_number}}, {{queue_name}}, {{branch_name}}, {{time}}.",
          "Задайте размер бумаги в миллиметрах. Разместите текст и фото. Переменные: {{ticket_number}}, {{queue_name}}, {{branch_name}}, {{time}}.",
          "Qog‘oz o‘lchamini millimetrda kiriting. Matn va rasmlarni joylashtiring. O‘zgaruvchilar: {{ticket_number}}, {{queue_name}}, {{branch_name}}, {{time}}.",
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <select
          className="rounded border bg-background p-2"
          aria-label="Template"
          value={id}
          onChange={(e) => {
            const t = templates.find((t) => t.id === e.target.value);
            setId(e.target.value);
            setForm(t ? { ...t, layout: t.layout?.blocks ? t.layout : empty().layout } : empty());
          }}
        >
          <option value="">{label("New template", "Новый шаблон", "Yangi shablon")}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label>
          {label("Name", "Название", "Nomi")}
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        {(["width_mm", "height_mm"] as const).map((key) => (
          <label key={key}>
            {key}
            <Input
              className="w-28"
              type="number"
              min={20}
              max={500}
              value={form[key]}
              onChange={(e) => {
                const n = Math.max(20, Math.min(500, Number(e.target.value)));
                setForm({
                  ...form,
                  [key]: n,
                  layout: {
                    ...form.layout,
                    [key === "width_mm" ? "width" : "height"]: Math.round(n * 3.78),
                  },
                });
              }}
            />
          </label>
        ))}
        <label className="p-2">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />{" "}
          {label("Default", "По умолчанию", "Standart")}
        </label>
        <Button disabled={save.isPending || !form.name.trim()} onClick={() => save.mutate()}>
          {label("Save", "Сохранить", "Saqlash")}
        </Button>
        {id && (
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm(label("Delete template?", "Удалить шаблон?", "Shablon o‘chirilsinmi?")))
                remove.mutate();
            }}
          >
            {label("Delete", "Удалить", "O‘chirish")}
          </Button>
        )}
      </div>
      <CanvasDesigner
        receipt
        key={id}
        value={form.layout}
        onChange={(layout) => setForm({ ...form, layout })}
      />
    </div>
  );
}
