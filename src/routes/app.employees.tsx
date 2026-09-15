import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { employeesApi, branchesApi, countersApi, queuesApi, menusApi, type Menu } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, UserCog, Monitor, Hash, KeyRound, ListChecks, Pencil, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/employees")({
  beforeLoad: requireCompanyAdmin,
  component: Employees,
});

function Employees() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { t, lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const qc = useQueryClient();
  const companyId = user?.type === "company_user" ? user.company_id! : (currentCompanyId ?? "");

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: () => employeesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: counters = [] } = useQuery({
    queryKey: ["counters-employees", companyId, currentBranchId],
    queryFn: () =>
      countersApi.list({
        company_id: companyId,
        ...(currentBranchId && { branch_id: currentBranchId }),
      }).then((r) => r.data),
    enabled: !!companyId,
  });

  // All menus are used to restrict an operator by a parent menu and its sub-items.
  const { data: allMenus = [] } = useQuery({
    queryKey: ["menus-employees", companyId],
    queryFn: () => menusApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  // All queue groups (services) for the company — used to restrict operator access
  const { data: allQueues = [] } = useQuery({
    queryKey: ["queues-employees", companyId],
    queryFn: () => queuesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["employee-roles", companyId],
    queryFn: () => employeesApi.listRoles({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  // ── Form state ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    password: "", phone: "", branch_id: "", role_id: "", avatar_url: "" as string | null,
  });
  const resetForm = () => {
    setEditId(null);
    setForm({ first_name: "", last_name: "", email: "", password: "", phone: "", branch_id: "", role_id: "", avatar_url: "" });
  };
  const startCreate = () => { resetForm(); setOpen(true); };
  const startEdit = (employee: (typeof employees)[number]) => {
    setEditId(employee.id);
    setForm({
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      email: employee.email || "",
      password: "",
      phone: employee.phone || "",
      branch_id: employee.branch_id || "",
      role_id: employee.roles?.[0]?.company_role.id || "",
      avatar_url: employee.avatar_url || "",
    });
    setOpen(true);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      employeesApi.create({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        avatar_url: form.avatar_url || undefined,
        company_id: companyId,
        branch_id: form.branch_id || undefined,
        role_ids: form.role_id ? [form.role_id] : undefined,
      }),
    onSuccess: () => {
      toast.success(L("Employee created", "Сотрудник создан", "Xodim yaratildi"));
      setOpen(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Error creating employee", "Ошибка создания сотрудника", "Xodim yaratishda xatolik")),
  });


  const employeeSaveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || null,
        branch_id: form.branch_id || null,
        role_ids: form.role_id ? [form.role_id] : [],
        avatar_url: form.avatar_url || null,
      };
      if (form.password) body.password = form.password;
      return employeesApi.update(editId!, body);
    },
    onSuccess: () => {
      toast.success(L("Employee updated", "Сотрудник обновлён", "Xodim yangilandi"));
      setOpen(false);
      resetForm();
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Failed to update", "Не удалось обновить", "Yangilab bo‘lmadi")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      toast.success(L("Employee removed", "Сотрудник удалён", "Xodim o‘chirildi"));
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      employeesApi.update(id, data),
    onSuccess: () => {
      toast.success(L("Counter assigned", "Кабинет назначен", "Kabinet biriktirildi"));
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Failed to update", "Не удалось обновить", "Yangilab bo‘lmadi")),
  });

  const counterUpdateMutation = useMutation({
    mutationFn: ({ counterId, number }: { counterId: string; number: number }) =>
      countersApi.update(counterId, { number }),
    onSuccess: () => {
      toast.success(L("Window number updated", "Номер окна обновлён", "Oyna raqami yangilandi"));
      void qc.invalidateQueries({ queryKey: ["counters-employees"] });
      void qc.invalidateQueries({ queryKey: ["counters"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Failed to update window number", "Не удалось обновить номер окна", "Oyna raqamini yangilab bo‘lmadi")),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      employeesApi.update(id, { password } as Record<string, unknown>),
    onSuccess: () => toast.success(L("Password reset successfully", "Пароль успешно сброшен", "Parol muvaffaqiyatli almashtirildi")),
    onError: (e) => toast.error(e instanceof Error ? e.message : L("Failed to reset password", "Не удалось сбросить пароль", "Parolni almashtirib bo‘lmadi")),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCounterLabel = (counterId: string | undefined) => {
    if (!counterId) return "—";
    const c = counters.find((x) => x.id === counterId);
    if (!c) return counterId.slice(0, 8) + "…";
    const name = loc(c as unknown as Record<string, unknown>, "name", lang) || c.name_uz;
    return `${name}${c.number ? ` (#${c.number})` : ""}`;
  };

  // Separate operator and admin roles
  const operatorRoles = roles.filter((r) => r.type === "OPERATOR");
  const adminRoles = roles.filter((r) => r.type !== "OPERATOR");

  if (!companyId) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        {L("Select a company first.", "Сначала выберите компанию.", "Avval kompaniyani tanlang.")}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("employees")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {L("Manage staff. Operators get their own login and queue calling interface.", "Управляйте сотрудниками. У операторов отдельный вход и панель вызова очереди.", "Xodimlarni boshqaring. Operatorlarda alohida kirish va navbat chaqirish paneli bor.")}
          </p>
        </div>

        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}><Plus className="mr-1.5 h-4 w-4" />{t("add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editId ? L("Edit employee", "Редактировать сотрудника", "Xodimni tahrirlash") : L("Add employee", "Добавить сотрудника", "Xodim qo‘shish")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {form.avatar_url ? <img src={form.avatar_url} alt="" className="h-full w-full object-cover" /> : `${form.first_name?.[0] || ""}${form.last_name?.[0] || ""}` || <ImageIcon className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                  <Label>{L("Profile photo", "Фото профиля", "Profil rasmi")}</Label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="text-xs"
                    onChange={(ev) => {
                      const file = ev.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1024 * 1024) {
                        toast.error(L("Maximum image size is 1 MB", "Максимум 1 МБ", "Maksimum 1 MB"));
                        ev.currentTarget.value = "";
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setForm((prev) => ({ ...prev, avatar_url: String(reader.result) }));
                      reader.readAsDataURL(file);
                    }}
                  />
                  {form.avatar_url && <button type="button" className="text-xs text-destructive underline" onClick={() => setForm({ ...form, avatar_url: "" })}>{L("Remove photo", "Удалить фото", "Rasmni olib tashlash")}</button>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>{L("First name *", "Имя *", "Ism *")}</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>{L("Last name *", "Фамилия *", "Familiya *")}</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>{L("Email *", "Email *", "Email *")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>{editId ? L("New password", "Новый пароль", "Yangi parol") : L("Password *", "Пароль *", "Parol *")}</Label>
                <Input
                  type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editId ? L("Leave empty to keep current password", "Оставьте пустым, чтобы сохранить пароль", "Parol o‘zgarmasa bo‘sh qoldiring") : L("Min 8 characters", "Минимум 8 символов", "Kamida 8 belgi")}
                />
              </div>
              <div>
                <Label>{L("Phone", "Телефон", "Telefon")}</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>{L("Branch", "Филиал", "Filial")}</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder={L("Select branch…", "Выберите филиал…", "Filialni tanlang…")} /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{L("Role *", "Роль *", "Rol *")}</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder={L("Select role…", "Выберите роль…", "Rolni tanlang…")} /></SelectTrigger>
                  <SelectContent>
                    {/* Operator roles — shown first and prominently */}
                    {operatorRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          {L("Operator (gets operator login page)", "Оператор (отдельная страница входа)", "Operator (operator kirish sahifasi)")}
                        </div>
                        {operatorRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="flex items-center gap-2">
                              <UserCog className="h-3.5 w-3.5 text-blue-600" />
                              {r.name}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {/* Admin/other roles */}
                    {adminRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mt-1">
                          {L("Admin / Other", "Админ / другое", "Admin / boshqa")}
                        </div>
                        {adminRoles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className="flex items-center gap-2">
                              <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                              {r.name}
                            </span>
                          </SelectItem>
                        ))}
                      </>
                    )}
                    {roles.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        {L("No roles found — they will be created automatically", "Роли не найдены — они будут созданы автоматически", "Rollar topilmadi — avtomatik yaratiladi")}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {form.role_id && operatorRoles.some(r => r.id === form.role_id) && (
                  <p className="mt-1 text-xs text-blue-600">
                    {L("This employee will log in at", "Этот сотрудник будет входить через", "Bu xodim") } <strong>/operator</strong> {L("and see their queue console", "и видеть панель очереди", "orqali kirib, navbat panelini ko‘radi")}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button
                onClick={() => (editId ? employeeSaveMutation.mutate() : createMutation.mutate())}
                disabled={!form.first_name || !form.last_name || !form.email || (!editId && !form.password) || createMutation.isPending || employeeSaveMutation.isPending}
              >
                {createMutation.isPending || employeeSaveMutation.isPending ? "…" : editId ? L("Save", "Сохранить", "Saqlash") : t("add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* No counters hint */}
      {counters.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Monitor className="inline mr-1.5 h-4 w-4" />
          {L("No counters found for this branch. Create counters first so you can assign them to operators.", "В этом филиале нет кабинетов. Сначала создайте кабинеты, чтобы назначить их операторам.", "Bu filialda kabinetlar topilmadi. Operatorlarga biriktirish uchun avval kabinet yarating.")}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">{L("No employees yet", "Сотрудников пока нет", "Hali xodimlar yo‘q")}</p>
          <p className="mt-1 text-sm">{L("Add your first staff member. Operators get a dedicated login page.", "Добавьте первого сотрудника. У операторов отдельная страница входа.", "Birinchi xodimni qo‘shing. Operatorlarda alohida kirish sahifasi bor.")}</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{L("Name", "Имя", "Ism")}</TableHead>
                <TableHead>{L("Email", "Email", "Email")}</TableHead>
                <TableHead>{L("Branch", "Филиал", "Filial")}</TableHead>
                <TableHead>{L("Status", "Статус", "Holat")}</TableHead>
                <TableHead>{L("Role", "Роль", "Rol")}</TableHead>
                <TableHead>{L("Window #", "Окно #", "Oyna #")}</TableHead>
                <TableHead>{L("Counter / Room", "Кабинет / окно", "Kabinet / xona")}</TableHead>
                <TableHead>{L("Services", "Услуги", "Xizmatlar")}</TableHead>
                <TableHead>{L("Last login", "Последний вход", "Oxirgi kirish")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((e) => {
                const isOperator = (e.roles ?? []).some(
                  (r) => r.company_role.type === "OPERATOR"
                );
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {e.avatar_url ? <img src={e.avatar_url} alt="" className="h-full w-full object-cover" /> : `${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`}
                        </span>
                        <span>{e.first_name} {e.last_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {e.branch
                        ? loc(e.branch as unknown as Record<string, unknown>, "name", lang) ||
                          (e.branch as { name?: string }).name
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          e.status === "ACTIVE"
                            ? "border-green-300 text-green-700"
                            : "border-slate-300 text-slate-400"
                        }`}
                      >
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(e.roles ?? []).map((role) => (
                          <Badge
                            key={role.company_role.id}
                            variant={role.company_role.type === "OPERATOR" ? "secondary" : "outline"}
                            className={`text-xs ${role.company_role.type === "OPERATOR" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" : ""}`}
                          >
                            {role.company_role.type === "OPERATOR" && <UserCog className="mr-1 h-3 w-3" />}
                            {role.company_role.name}
                          </Badge>
                        ))}
                        {(e.roles ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">{L("No role", "Нет роли", "Rol yo‘q")}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Window # — shows counter.number, editable inline */}
                    <TableCell>
                      {isOperator && e.default_counter_id ? (
                        <WindowNumberCell
                          value={counters.find((c) => c.id === e.default_counter_id)?.number}
                          onSave={(num) => {
                            if (num == null) return;
                            counterUpdateMutation.mutate({
                              counterId: e.default_counter_id!,
                              number: num,
                            });
                          }}
                        />
                      ) : isOperator ? (
                        <span className="text-xs text-muted-foreground italic">{L("Assign counter first", "Сначала назначьте кабинет", "Avval kabinet biriktiring")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Counter assignment — only for operators */}
                    <TableCell>
                      {isOperator ? (
                        <div className="space-y-1">
                          <Select
                            value={e.default_counter_id ?? "__unassigned__"}
                            onValueChange={(v) =>
                              updateMutation.mutate({
                                id: e.id,
                                data: { default_counter_id: v === "__unassigned__" ? null : v },
                              })
                            }
                          >
                            <SelectTrigger className="h-8 w-52">
                              <SelectValue placeholder={L("Assign counter…", "Назначить кабинет…", "Kabinet biriktirish…")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unassigned__">— {L("Unassigned", "Не назначено", "Biriktirilmagan")} —</SelectItem>
                              {counters.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  {L("No counters — create them in Counters page", "Нет кабинетов — создайте их на странице кабинетов", "Kabinetlar yo‘q — Kabinetlar sahifasida yarating")}
                                </div>
                              ) : (
                                counters.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    <span className="flex items-center gap-2">
                                      <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                                      {loc(c as unknown as Record<string, unknown>, "name", lang) || c.name_uz}
                                      {c.number != null && (
                                        <span className="text-muted-foreground">#{c.number}</span>
                                      )}
                                    </span>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          {e.default_counter_id && (
                            <p className="text-[11px] text-muted-foreground pl-1">
                              {getCounterLabel(e.default_counter_id)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Service restriction — only for operators */}
                    <TableCell>
                      {isOperator ? (
                        <ServiceRestrictCell
                          employeeId={e.id}
                          currentIds={(e.allowed_service_ids as string[] | null) ?? null}
                          currentMenuIds={(e.allowed_menu_ids as string[] | null) ?? null}
                          allQueues={allQueues as import("@/lib/api").QueueGroup[]}
                          allMenus={allMenus as Menu[]}
                          lang={lang as import("@/lib/i18n").Lang}
                          onSave={(ids, menuIds) => updateMutation.mutate({ id: e.id, data: { allowed_service_ids: ids, allowed_menu_ids: menuIds } })}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {e.last_login_at ? new Date(e.last_login_at).toLocaleDateString() : L("Never", "Никогда", "Hech qachon")}
                    </TableCell>                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(e)} title={L("Edit employee", "Редактировать сотрудника", "Xodimni tahrirlash")}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ResetPasswordButton
                          onReset={(pwd) => resetPasswordMutation.mutate({ id: e.id, password: pwd })}
                          isPending={resetPasswordMutation.isPending}
                        />
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Remove ${e.first_name} ${e.last_name}?`))
                              deleteMutation.mutate(e.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Inline window-number editor ───────────────────────────────────────────────
function WindowNumberCell({
  value,
  onSave,
}: {
  value?: number | null;
  onSave: (num: number | null) => void;
}) {
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));

  const commit = () => {
    const n = draft.trim() === "" ? null : Number(draft);
    onSave(isNaN(n as number) ? null : n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input type="number" min={1} className="h-7 w-20 text-sm" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          autoFocus />
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={commit}>✓</Button>
      </div>
    );
  }

  return (
    <button onClick={() => { setDraft(String(value ?? "")); setEditing(true); }}
      className="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted transition"
      title={L("Click to set window number", "Нажмите, чтобы задать номер окна", "Oyna raqamini kiritish uchun bosing")}>
      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
      {value != null ? <span className="font-mono font-bold">{value}</span> : <span className="text-muted-foreground text-xs">{L("Set #", "Задать #", "# kiritish")}</span>}
    </button>
  );
}

// ── Inline reset-password button ──────────────────────────────────────────────
function ResetPasswordButton({ onReset, isPending }: { onReset: (pwd: string) => void; isPending: boolean }) {
  const { lang } = useLang();
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");

  const submit = () => {
    if (pwd.length < 6) return;
    onReset(pwd);
    setPwd("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title={L("Reset password", "Сбросить пароль", "Parolni almashtirish")}>
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{L("Reset password", "Сбросить пароль", "Parolni almashtirish")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{L("Set a new password for this employee.", "Задайте новый пароль для этого сотрудника.", "Bu xodim uchun yangi parol kiriting.")}</p>
          <div>
            <Label>{L("New password", "Новый пароль", "Yangi parol")}</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder={L("Min 6 characters", "Минимум 6 символов", "Kamida 6 belgi")} className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{L("Cancel", "Отмена", "Bekor qilish")}</Button>
          <Button onClick={submit} disabled={pwd.length < 6 || isPending}>
            {isPending ? L("Saving…", "Сохранение…", "Saqlanmoqda…") : L("Set password", "Задать пароль", "Parolni kiritish")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ── Service restriction picker ────────────────────────────────────────────────
// Admin uses this to limit which menu/service groups an operator can call tickets from.
interface ServiceRestrictCellProps {
  employeeId: string;
  currentIds: string[] | null;
  currentMenuIds: string[] | null;
  allQueues: import("@/lib/api").QueueGroup[];
  allMenus: Menu[];
  lang: import("@/lib/i18n").Lang;
  onSave: (ids: string[] | null, menuIds: string[] | null) => void;
}

function flattenMenus(items: Menu[], depth = 0): Array<Menu & { depth: number }> {
  return items.flatMap((item) => [
    { ...item, depth },
    ...flattenMenus(item.children || [], depth + 1),
  ]);
}

function ServiceRestrictCell({ currentIds, currentMenuIds, allQueues, allMenus, lang, onSave }: ServiceRestrictCellProps) {
  const [open, setOpen] = useState(false);
  const isRestricted = currentIds !== null || currentMenuIds !== null;
  const [restricted, setRestricted] = useState(isRestricted);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentIds ?? []));
  const [selectedMenus, setSelectedMenus] = useState<Set<string>>(new Set(currentMenuIds ?? []));
  const flatMenus = flattenMenus(allMenus);
  const L = (en: string, ru: string, uz: string) => (lang === "ru" ? ru : lang === "uz" ? uz : en);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMenu = (id: string) => {
    setSelectedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = () => {
    onSave(restricted ? Array.from(selected) : null, restricted ? Array.from(selectedMenus) : null);
    setOpen(false);
  };

  const totalSelected = (currentIds?.length ?? 0) + (currentMenuIds?.length ?? 0);
  const label = !isRestricted
    ? <span className="text-xs text-muted-foreground italic">{L("All menus and services", "Все меню и услуги", "Barcha menyu va xizmatlar")}</span>
    : totalSelected === 0
      ? <span className="text-xs text-amber-600">{L("None assigned", "Ничего не назначено", "Hech narsa berilmagan")}</span>
      : (
        <div className="flex max-w-[200px] flex-wrap gap-1">
          {currentMenuIds?.slice(0, 2).map((id) => {
            const m = flatMenus.find((m) => m.id === id);
            return m ? (
              <Badge key={id} variant="secondary" className="px-1.5 text-[10px]">
                {loc(m as unknown as Record<string, unknown>, "name", lang) || m.name}
              </Badge>
            ) : null;
          })}
          {currentIds?.slice(0, 2).map((id) => {
            const q = allQueues.find((q) => q.id === id || (q as any).service_id === id);
            return q ? (
              <Badge key={id} variant="outline" className="px-1.5 text-[10px]">
                {loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz}
              </Badge>
            ) : null;
          })}
          {totalSelected > 4 && <Badge variant="outline" className="px-1.5 text-[10px]">+{totalSelected - 4}</Badge>}
        </div>
      );

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (v) {
        setRestricted(currentIds !== null || currentMenuIds !== null);
        setSelected(new Set(currentIds ?? []));
        setSelectedMenus(new Set(currentMenuIds ?? []));
      }
      setOpen(v);
    }}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded px-2 py-1 text-left transition hover:bg-muted" title={L("Set allowed menus and services", "Настроить доступ к меню и услугам", "Menyu va xizmatlarga ruxsat berish")}>
          <ListChecks className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {label}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{L("Allowed menus and services", "Доступные меню и услуги", "Ruxsat berilgan menyu va xizmatlar")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {L(
            "Choose a parent menu to allow every service inside it, or choose individual services for a narrower access rule.",
            "Выберите родительское меню, чтобы разрешить все услуги внутри него, или выберите отдельные услуги для более точного доступа.",
            "Ichidagi barcha xizmatlarga ruxsat berish uchun ota menyuni tanlang yoki aniqroq ruxsat uchun alohida xizmatlarni belgilang.",
          )}
        </p>

        <div className="flex items-center gap-3 rounded-lg border p-3">
          <Checkbox
            id="restrict-toggle"
            checked={restricted}
            onCheckedChange={(v) => {
              setRestricted(!!v);
              if (!v) { setSelected(new Set()); setSelectedMenus(new Set()); }
            }}
          />
          <label htmlFor="restrict-toggle" className="cursor-pointer select-none text-sm font-medium">
            {L("Restrict this operator", "Ограничить этого оператора", "Bu operatorni cheklash")}
          </label>
        </div>

        {restricted && (
          <div className="grid max-h-[55vh] gap-4 overflow-y-auto rounded-lg border p-3 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {L("Menus include all sub-menu services", "Меню включает все услуги внутри", "Menyu ichidagi barcha xizmatlarni qamrab oladi")}
              </p>
              {flatMenus.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{L("No menus found", "Меню не найдены", "Menyular topilmadi")}</p>
              ) : (
                <div className="space-y-1">
                  {flatMenus.map((m) => {
                    const name = loc(m as unknown as Record<string, unknown>, "name", lang) || m.name;
                    return (
                      <div key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted" style={{ paddingLeft: 8 + m.depth * 16 }} onClick={() => toggleMenu(m.id)}>
                        <Checkbox checked={selectedMenus.has(m.id)} onCheckedChange={() => toggleMenu(m.id)} />
                        <label className="flex-1 cursor-pointer select-none text-sm">{name}</label>
                        <Badge variant={m.queue_group_id ? "secondary" : "outline"} className="text-[10px]">
                          {m.queue_group_id ? L("service", "услуга", "xizmat") : L("menu", "меню", "menyu")}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                {L("Individual services", "Отдельные услуги", "Alohida xizmatlar")}
              </p>
              {allQueues.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">{L("No queue groups found", "Очереди не найдены", "Navbat guruhlari topilmadi")}</p>
              ) : (
                <div className="space-y-1">
                  {allQueues.map((q) => {
                    const name = loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz;
                    return (
                      <div key={q.id} className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-muted" onClick={() => toggle(q.id)}>
                        <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggle(q.id)} />
                        <label className="flex-1 cursor-pointer select-none text-sm">{name}</label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {restricted && selected.size === 0 && selectedMenus.size === 0 && (
          <p className="px-1 text-xs text-amber-600">
            ⚠ {L("No access selected — operator will not be able to call tickets", "Доступ не выбран — оператор не сможет вызывать талоны", "Ruxsat tanlanmadi — operator chiptalarni chaqira olmaydi")}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{L("Cancel", "Отмена", "Bekor qilish")}</Button>
          <Button onClick={save}>{L("Save", "Сохранить", "Saqlash")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
