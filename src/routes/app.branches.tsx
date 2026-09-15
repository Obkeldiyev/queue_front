import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { branchesApi, type Branch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, MapPin, Phone, GitBranch, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/branches")({ beforeLoad: requireCompanyAdmin, component: Branches });

const emptyForm = { name_uz: "", name_ru: "", name_en: "", address: "", phone: "" };

function Branches() {
  const { user } = useAuthStore();
  const { currentCompanyId, setCurrentBranch } = useStore();
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";
  const { data: branches = [], isLoading } = useQuery({ queryKey: ["branches", companyId], queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data), enabled: !!companyId });
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const reset = () => { setEditId(null); setForm(emptyForm); };
  const startCreate = () => { reset(); setOpen(true); };
  const startEdit = (b: Branch) => { setEditId(b.id); setForm({ name_uz: b.name_uz || "", name_ru: b.name_ru || "", name_en: b.name_en || "", address: b.address_uz || "", phone: b.phone || "" }); setOpen(true); };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { company_id: companyId, name_uz: form.name_uz.trim(), name_ru: form.name_ru.trim() || undefined, name_en: form.name_en.trim() || undefined, address_uz: form.address.trim() || undefined, phone: form.phone.trim() || undefined };
      return editId ? branchesApi.update(editId, payload) : branchesApi.create(payload);
    },
    onSuccess: (res) => { toast.success(editId ? L("Branch updated", "Филиал обновлён", "Filial yangilandi") : L("Branch created", "Филиал создан", "Filial yaratildi")); if (!editId) setCurrentBranch(res.data.id); setOpen(false); reset(); void qc.invalidateQueries({ queryKey: ["branches"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")),
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => branchesApi.delete(id), onSuccess: () => { toast.success(L("Branch deleted", "Филиал удалён", "Filial o‘chirildi")); void qc.invalidateQueries({ queryKey: ["branches"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")) });

  if (!companyId) return <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">{L("Select a company first.", "Сначала выберите компанию.", "Avval kompaniyani tanlang.")}</div>;

  return <div>
    <div className="mb-6 flex items-end justify-between">
      <div><h1 className="text-2xl font-bold">{L("Branches", "Филиалы", "Filiallar")}</h1><p className="mt-0.5 text-sm text-muted-foreground">{L("Physical locations for this company", "Физические точки этой компании", "Kompaniyaning jismoniy manzillari")}</p></div>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogTrigger asChild><Button onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" />{L("New branch", "Новый филиал", "Yangi filial")}</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? L("Edit branch", "Редактировать филиал", "Filialni tahrirlash") : L("Create branch", "Создать филиал", "Filial yaratish")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2"><div><Label>{L("Name (UZ) *", "Название (UZ) *", "Nomi (UZ) *")}</Label><Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} className="mt-1" /></div><div><Label>{L("Name (RU)", "Название (RU)", "Nomi (RU)")}</Label><Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className="mt-1" /></div><div><Label>{L("Name (EN)", "Название (EN)", "Nomi (EN)")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="mt-1" /></div></div>
            <div><Label>{L("Address", "Адрес", "Manzil")}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" /></div>
            <div><Label>{L("Phone", "Телефон", "Telefon")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{L("Cancel", "Отмена", "Bekor qilish")}</Button><Button onClick={() => saveMutation.mutate()} disabled={!form.name_uz.trim() || saveMutation.isPending}>{saveMutation.isPending ? "…" : editId ? L("Save", "Сохранить", "Saqlash") : L("Create", "Создать", "Yaratish")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    {isLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}</div> : branches.length === 0 ? <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground"><GitBranch className="mx-auto mb-3 h-8 w-8 opacity-30" /><p className="font-medium">{L("No branches yet", "Филиалов пока нет", "Hali filiallar yo‘q")}</p><p className="mt-1 text-sm">{L("Create the first branch to start managing queues.", "Создайте первый филиал, чтобы начать управление очередями.", "Navbatlarni boshqarishni boshlash uchun birinchi filialni yarating.")}</p></div> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{branches.map((b) => <Card key={b.id}><CardHeader className="pb-2"><CardTitle className="flex items-center justify-between gap-2 text-base"><span className="truncate">{loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}</span><span className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(L("Delete this branch?", "Удалить этот филиал?", "Bu filial o‘chirilsinmi?"))) deleteMutation.mutate(b.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></span></CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground">{b.address_uz && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.address_uz}</span></div>}{b.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{b.phone}</div>}<div className="flex items-center gap-2 pt-1"><Badge variant="outline" className={`text-xs ${b.status === "ACTIVE" ? "border-green-300 text-green-700" : "border-slate-300 text-slate-400"}`}>{b.status}</Badge><Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={() => { setCurrentBranch(b.id); toast.success(L("Branch selected", "Филиал выбран", "Filial tanlandi")); }}>{L("Set active", "Выбрать", "Tanlash")}</Button></div></CardContent></Card>)}</div>}
  </div>;
}
