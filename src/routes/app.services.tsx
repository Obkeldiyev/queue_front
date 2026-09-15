import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { servicesApi, type Service } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, Layers, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/services")({ beforeLoad: requireCompanyAdmin, component: Services });
const emptyForm = { name_uz: "", name_ru: "", name_en: "", description_uz: "", estimated_time_mins: 10 };

function Services() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";
  const { data: services = [], isLoading } = useQuery({ queryKey: ["services", companyId], queryFn: () => servicesApi.list({ company_id: companyId }).then((r) => r.data), enabled: !!companyId });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const reset = () => { setEditId(null); setForm(emptyForm); };
  const startCreate = () => { reset(); setOpen(true); };
  const startEdit = (s: Service) => { setEditId(s.id); setForm({ name_uz: s.name_uz || "", name_ru: s.name_ru || "", name_en: s.name_en || "", description_uz: s.description_uz || "", estimated_time_mins: s.estimated_time_mins || 10 }); setOpen(true); };
  const saveMutation = useMutation({ mutationFn: () => {
    const payload = { company_id: companyId, ...(currentBranchId && { branch_id: currentBranchId }), name_uz: form.name_uz.trim(), name_ru: form.name_ru.trim() || undefined, name_en: form.name_en.trim() || undefined, description_uz: form.description_uz.trim() || undefined, estimated_time_mins: Number(form.estimated_time_mins) || 1 };
    return editId ? servicesApi.update(editId, payload) : servicesApi.create(payload);
  }, onSuccess: () => { toast.success(editId ? L("Service updated", "Услуга обновлена", "Xizmat yangilandi") : L("Service created", "Услуга создана", "Xizmat yaratildi")); setOpen(false); reset(); void qc.invalidateQueries({ queryKey: ["services"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => servicesApi.delete(id), onSuccess: () => { toast.success(L("Service deleted", "Услуга удалена", "Xizmat o‘chirildi")); void qc.invalidateQueries({ queryKey: ["services"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")) });

  return <div>
    <div className="mb-6 flex items-end justify-between"><div><h1 className="text-2xl font-bold">{L("Services", "Услуги", "Xizmatlar")}</h1><p className="mt-0.5 text-sm text-muted-foreground">{L("What this company offers in its queues", "Что компания предлагает в очередях", "Kompaniya navbatlarda taklif qiladigan xizmatlar")}</p></div><Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}><DialogTrigger asChild><Button onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" />{L("New service", "Новая услуга", "Yangi xizmat")}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{editId ? L("Edit service", "Редактировать услугу", "Xizmatni tahrirlash") : L("Create service", "Создать услугу", "Xizmat yaratish")}</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-3 gap-2"><div><Label>{L("Name (UZ) *", "Название (UZ) *", "Nomi (UZ) *")}</Label><Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} className="mt-1" /></div><div><Label>{L("Name (RU)", "Название (RU)", "Nomi (RU)")}</Label><Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className="mt-1" /></div><div><Label>{L("Name (EN)", "Название (EN)", "Nomi (EN)")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="mt-1" /></div></div><div><Label>{L("Description", "Описание", "Tavsif")}</Label><Input value={form.description_uz} onChange={(e) => setForm({ ...form, description_uz: e.target.value })} className="mt-1" /></div><div><Label>{L("Avg. service time (minutes)", "Среднее время услуги (минуты)", "O‘rtacha xizmat vaqti (daqiqa)")}</Label><Input type="number" min={1} value={form.estimated_time_mins} onChange={(e) => setForm({ ...form, estimated_time_mins: +e.target.value })} className="mt-1" /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{L("Cancel", "Отмена", "Bekor qilish")}</Button><Button onClick={() => saveMutation.mutate()} disabled={!form.name_uz.trim() || saveMutation.isPending}>{saveMutation.isPending ? "…" : editId ? L("Save", "Сохранить", "Saqlash") : L("Create", "Создать", "Yaratish")}</Button></DialogFooter></DialogContent></Dialog></div>
    {isLoading ? <div className="h-48 animate-pulse rounded-xl bg-muted" /> : services.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground"><Layers className="mx-auto mb-3 h-8 w-8 opacity-30" /><p className="font-medium">{L("No services yet", "Услуг пока нет", "Hali xizmatlar yo‘q")}</p><p className="mt-1 text-sm">{L("Create services first, then link them to queues.", "Сначала создайте услуги, затем свяжите их с очередями.", "Avval xizmatlarni yarating, keyin ularni navbatlarga ulang.")}</p></div> : <div className="overflow-hidden rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>{L("Name", "Название", "Nomi")}</TableHead><TableHead>{L("Description", "Описание", "Tavsif")}</TableHead><TableHead>{L("Avg. Time", "Сред. время", "O‘rt. vaqt")}</TableHead><TableHead /></TableRow></TableHeader><TableBody>{services.map((s) => <TableRow key={s.id}><TableCell className="font-medium">{loc(s as unknown as Record<string, unknown>, "name", lang) || s.name_uz}</TableCell><TableCell className="text-sm text-muted-foreground">{loc(s as unknown as Record<string, unknown>, "description", lang) || s.description_uz || "—"}</TableCell><TableCell>{s.estimated_time_mins ? <Badge variant="secondary">{s.estimated_time_mins} {L("min", "мин", "daq")}</Badge> : "—"}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(L("Delete this service?", "Удалить эту услугу?", "Bu xizmat o‘chirilsinmi?"))) deleteMutation.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}
  </div>;
}
