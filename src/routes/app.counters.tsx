import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { countersApi, queuesApi, branchesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, Monitor, X, AlertCircle, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/counters")({ beforeLoad: requireCompanyAdmin, component: Counters });

function Counters() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: counters = [], isLoading } = useQuery({
    queryKey: ["counters", companyId, currentBranchId],
    queryFn: () => countersApi.list({ ...(companyId && { company_id: companyId }), ...(currentBranchId && { branch_id: currentBranchId }) }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: queues = [] } = useQuery({
    queryKey: ["queues", companyId, currentBranchId],
    queryFn: () => queuesApi.list({ ...(companyId && { company_id: companyId }), ...(currentBranchId && { branch_id: currentBranchId }) }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const emptyForm = { name_uz: "", name_ru: "", name_en: "", number: 1, branch_id: currentBranchId ?? "" };
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const resetForm = () => { setEditId(null); setForm({ ...emptyForm, branch_id: currentBranchId ?? "" }); };
  const startCreate = () => { resetForm(); setOpen(true); };
  const startEdit = (c: import("@/lib/api").Counter) => { setEditId(c.id); setForm({ name_uz: c.name_uz || "", name_ru: c.name_ru || "", name_en: c.name_en || "", number: c.number || 1, branch_id: c.branch_id || currentBranchId || "" }); setOpen(true); };

  const saveMutation = useMutation({
    mutationFn: () => editId
      ? countersApi.update(editId, { name_uz: form.name_uz, name_ru: form.name_ru || undefined, name_en: form.name_en || undefined, number: Number(form.number) || 1, branch_id: form.branch_id || currentBranchId! })
      : countersApi.create({ ...form, number: Number(form.number) || 1, branch_id: form.branch_id || currentBranchId!, company_id: companyId }),
    onSuccess: () => { toast.success(editId ? L("Counter updated", "Кабинет обновлён", "Kabinet yangilandi") : L("Counter created", "Кабинет создан", "Kabinet yaratildi")); setOpen(false); resetForm(); void qc.invalidateQueries({ queryKey: ["counters"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => countersApi.delete(id),
    onSuccess: () => { toast.success(L("Counter deleted", "Кабинет удалён", "Kabinet o‘chirildi")); void qc.invalidateQueries({ queryKey: ["counters"] }); },
  });

  const assignMutation = useMutation({
    mutationFn: ({ counterId, queueId }: { counterId: string; queueId: string }) => countersApi.assignQueue(counterId, queueId),
    onSuccess: () => { toast.success(L("Queue linked", "Очередь привязана", "Navbat ulandi")); void qc.invalidateQueries({ queryKey: ["counters"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Error", "Ошибка", "Xatolik")),
  });

  const removeMutation = useMutation({
    mutationFn: ({ counterId, queueId }: { counterId: string; queueId: string }) => countersApi.removeQueue(counterId, queueId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["counters"] }),
  });

  const noQueue = counters.filter((c) => (c.queue_groups ?? []).length === 0);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{L("Counters", "Кабинеты", "Kabinetlar")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{L("Each counter must have at least one queue linked so operators can call tickets", "К каждому кабинету нужно привязать хотя бы одну очередь, чтобы операторы могли вызывать талоны", "Operatorlar chipta chaqirishi uchun har bir kabinetga kamida bitta navbat ulanishi kerak")}{!currentBranchId ? L(" — showing all branches", " — показаны все филиалы", " — barcha filiallar ko‘rsatilgan") : ""}.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" />{L("Create counter", "Создать кабинет", "Kabinet yaratish")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? L("Edit counter", "Редактировать кабинет", "Kabinetni tahrirlash") : L("Create counter", "Создать кабинет", "Kabinet yaratish")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {!currentBranchId && (
                <div><Label>{L("Branch *", "Филиал *", "Filial *")}</Label>
                  <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder={L("Select branch…", "Выберите филиал…", "Filialni tanlang…")} /></SelectTrigger>
                    <SelectContent>{branches.map((b) => <SelectItem key={b.id} value={b.id}>{loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <div><Label>{L("Name (UZ) *", "Название (UZ) *", "Nomi (UZ) *")}</Label><Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} className="mt-1" placeholder="1-kabinet" /></div>
                <div><Label>{L("Name (RU)", "Название (RU)", "Nomi (RU)")}</Label><Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className="mt-1" placeholder="Кабинет 1" /></div>
                <div><Label>{L("Name (EN)", "Название (EN)", "Nomi (EN)")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="mt-1" placeholder="Counter 1" /></div>
              </div>
              <div><Label>{L("Number *", "Номер *", "Raqam *")} <span className="text-xs text-muted-foreground">{L("(shown on display board)", "(показывается на табло)", "(ekranda ko‘rsatiladi)")}</span></Label>
                <Input type="number" min={1} value={form.number} onChange={(e) => setForm({ ...form, number: +e.target.value })} className="mt-1" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{L("Cancel", "Отмена", "Bekor qilish")}</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name_uz || (!form.branch_id && !currentBranchId) || saveMutation.isPending}>{saveMutation.isPending ? "…" : editId ? L("Save", "Сохранить", "Saqlash") : L("Create", "Создать", "Yaratish")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {noQueue.length > 0 && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 dark:text-amber-100">{noQueue.length} {L("counter(s) have no queues linked", "кабинетов без привязанных очередей", "kabinetda navbat ulanmagan")}</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300 text-xs">{L("Operators assigned to these cannot call tickets. Use the dropdown on each card to link a queue.", "Назначенные операторы не смогут вызывать талоны. Используйте список на карточке, чтобы привязать очередь.", "Bu kabinetlarga biriktirilgan operatorlar chipta chaqira olmaydi. Navbat ulash uchun kartadagi ro‘yxatdan foydalaning.")}</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : counters.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Monitor className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">{L("No counters yet", "Кабинетов пока нет", "Hali kabinetlar yo‘q")}</p>
          <p className="mt-1 text-sm">{L("Create counters, then link queues to them.", "Создайте кабинеты, затем привяжите к ним очереди.", "Kabinetlarni yarating, keyin ularga navbatlarni ulang.")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {counters.map((c) => {
            const linked = c.queue_groups ?? [];
            const linkedIds = linked.map((cq: Record<string, { id: string }>) => cq.queue_group.id);
            const available = queues.filter((q) => !linkedIds.includes(q.id));
            const session = c.sessions?.[0];
            return (
              <Card key={c.id} className={linked.length === 0 ? "border-amber-200 dark:border-amber-800" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">{c.number}</span>
                      {loc(c as unknown as Record<string, unknown>, "name", lang) || c.name_uz}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(L("Delete this counter?", "Удалить этот кабинет?", "Bu kabinet o‘chirilsinmi?"))) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {session ? (
                    <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {session.company_user?.first_name} {session.company_user?.last_name} — {L("working", "работает", "ishlamoqda")}
                    </div>
                  ) : <div className="text-xs text-muted-foreground">{L("No active operator", "Нет активного оператора", "Faol operator yo‘q")}</div>}

                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">{L("Linked queues", "Привязанные очереди", "Ulangan navbatlar")}</p>
                    {linked.length === 0 ? (
                      <p className="rounded-lg bg-amber-50 dark:bg-amber-950 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">{L("No queues — link one below", "Нет очередей — привяжите ниже", "Navbat yo‘q — quyida ulang")}</p>
                    ) : (
                      <div className="space-y-1">
                        {linked.map((cq: Record<string, { id: string }>) => (
                          <div key={cq.queue_group.id} className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                            <span className="font-medium">{loc(cq.queue_group as unknown as Record<string, unknown>, "name", lang)}</span>
                            <button onClick={() => removeMutation.mutate({ counterId: c.id, queueId: cq.queue_group.id })} className="ml-2 rounded p-0.5 text-muted-foreground hover:text-destructive transition"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {available.length > 0 && (
                    <InlineAssign available={available} lang={lang} onAssign={(queueId) => assignMutation.mutate({ counterId: c.id, queueId })} isPending={assignMutation.isPending} />
                  )}
                  <Badge variant="outline" className={`text-xs ${c.is_active ? "border-green-300 text-green-700" : "border-slate-300 text-slate-400"}`}>{c.is_active ? L("Active", "Активен", "Faol") : L("Inactive", "Неактивен", "Nofaol")}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InlineAssign({ available, lang, onAssign, isPending }: { available: import("@/lib/api").QueueGroup[]; lang: import("@/lib/i18n").Lang; onAssign: (id: string) => void; isPending: boolean }) {
  const [sel, setSel] = useState("");
  return (
    <div className="flex gap-1.5">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder={lang === "ru" ? "Добавить очередь…" : lang === "uz" ? "Navbat qo‘shish…" : "Add queue…"} /></SelectTrigger>
        <SelectContent>
          {available.map((q) => <SelectItem key={q.id} value={q.id}>{loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" className="h-8 px-3 text-xs" disabled={!sel || isPending} onClick={() => { onAssign(sel); setSel(""); }}>
        <Plus className="h-3 w-3 mr-1" />{lang === "ru" ? "Связать" : lang === "uz" ? "Ulash" : "Link"}
      </Button>
    </div>
  );
}

