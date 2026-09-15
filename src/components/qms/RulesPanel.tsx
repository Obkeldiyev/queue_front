import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { companiesApi } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
export function RulesPanel() {
  const { user } = useAuthStore();
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const { data: company } = useQuery({
    queryKey: ["company", user?.company_id],
    enabled: !!user?.company_id,
    queryFn: () => companiesApi.get(user!.company_id!).then((r) => r.data),
  });
  const [rules, setRules] = useState({
    max_shift_hours: 12,
    max_service_minutes: 30,
    instructions: "",
  });
  useEffect(() => {
    if (company) setRules({ ...rules, ...(company.settings as any)?.rules });
  }, [company]);
  const save = useMutation({
    mutationFn: () =>
      companiesApi.update(user!.company_id!, { settings: { ...(company?.settings || {}), rules } }),
    onSuccess: () => toast.success(L("Rules saved", "Правила сохранены", "Qoidalar saqlandi")),
    onError: (e) => toast.error(e.message),
  });
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="text-xl font-bold">
        {L(
          "Working rules & alerts",
          "Правила работы и уведомления",
          "Ish qoidalari va ogohlantirishlar",
        )}
      </h2>
      <label className="block">
        {L("Maximum shift (hours)", "Максимальная смена (часы)", "Maksimal smena (soat)")}
        <Input
          type="number"
          min={1}
          max={24}
          value={rules.max_shift_hours}
          onChange={(e) =>
            setRules({
              ...rules,
              max_shift_hours: Math.max(1, Math.min(24, Number(e.target.value))),
            })
          }
        />
      </label>
      <label className="block">
        {L(
          "Service time alert (minutes)",
          "Лимит обслуживания (минуты)",
          "Xizmat vaqti limiti (daqiqa)",
        )}
        <Input
          type="number"
          min={1}
          max={480}
          value={rules.max_service_minutes}
          onChange={(e) =>
            setRules({
              ...rules,
              max_service_minutes: Math.max(1, Math.min(480, Number(e.target.value))),
            })
          }
        />
      </label>
      <label className="block">
        {L("Operator instructions", "Инструкции операторам", "Operatorlar uchun ko‘rsatmalar")}
        <textarea
          className="mt-2 min-h-32 w-full rounded border bg-background p-3"
          value={rules.instructions}
          onChange={(e) => setRules({ ...rules, instructions: e.target.value })}
        />
      </label>
      <p className="text-sm text-muted-foreground">
        {L(
          "Queues reset at midnight in the company timezone. Previous tickets remain in history. KPI counts completed physical, online and recorded external services.",
          "Очереди сбрасываются в полночь по часовому поясу компании. История сохраняется. KPI учитывает завершённые очные, онлайн и внешние обращения.",
          "Navbatlar kompaniya vaqt mintaqasi bo‘yicha yarim tunda tiklanadi. Tarix saqlanadi. KPI yakunlangan barcha xizmatlarni hisoblaydi.",
        )}
      </p>
      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        {L("Save rules", "Сохранить правила", "Qoidalarni saqlash")}
      </Button>
    </section>
  );
}
export function ThemeToggle() {
  const { lang } = useLang();
  const [mode, setMode] = useState("system");
  useEffect(() => {
    setMode(localStorage.getItem("qms-theme") || "system");
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        mode === "dark" || (mode === "system" && media.matches),
      );
    apply();
    media.addEventListener("change", apply);
    localStorage.setItem("qms-theme", mode);
    return () => media.removeEventListener("change", apply);
  }, [mode]);
  return (
    <select
      aria-label="Appearance"
      className="max-w-28 rounded-lg border bg-background px-2 py-1 text-xs"
      value={mode}
      onChange={(e) => setMode(e.target.value)}
    >
      {["light", "dark", "system"].map((m, i) => (
        <option key={m} value={m}>
          {lang === "ru"
            ? ["Светлая", "Тёмная", "Системная"][i]
            : lang === "uz"
              ? ["Yorug‘", "Qorong‘i", "Tizim"][i]
              : ["Light", "Dark", "System"][i]}
        </option>
      ))}
    </select>
  );
}
