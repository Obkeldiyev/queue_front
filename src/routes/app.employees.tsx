import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { employeesApi, branchesApi, countersApi } from "@/lib/api";
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
import { useState } from "react";
import { Plus, Trash2, Users, ShieldCheck, UserCog, Monitor, Hash, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/employees")({
  beforeLoad: requireCompanyAdmin,
  component: Employees,
});

function Employees() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { t, lang } = useLang();
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

  const { data: roles = [] } = useQuery({
    queryKey: ["employee-roles", companyId],
    queryFn: () => employeesApi.listRoles({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  // ── Form state ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "",
    password: "", phone: "", branch_id: "", role_id: "",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () =>
      employeesApi.create({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        company_id: companyId,
        branch_id: form.branch_id || undefined,
        role_ids: form.role_id ? [form.role_id] : undefined,
      }),
    onSuccess: () => {
      toast.success("Employee created");
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", password: "", phone: "", branch_id: "", role_id: "" });
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error creating employee"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => employeesApi.delete(id),
    onSuccess: () => {
      toast.success("Employee removed");
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      employeesApi.update(id, data),
    onSuccess: () => {
      toast.success("Counter assigned");
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update"),
  });

  const counterUpdateMutation = useMutation({
    mutationFn: ({ counterId, number }: { counterId: string; number: number }) =>
      countersApi.update(counterId, { number }),
    onSuccess: () => {
      toast.success("Window number updated");
      void qc.invalidateQueries({ queryKey: ["counters-employees"] });
      void qc.invalidateQueries({ queryKey: ["counters"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update window number"),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      employeesApi.update(id, { password } as Record<string, unknown>),
    onSuccess: () => toast.success("Password reset successfully"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to reset password"),
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
        Select a company first.
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
            Manage staff. Operators get their own login and queue calling interface.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />{t("add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add employee</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>First name *</Label>
                  <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Last name *</Label>
                  <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Password *</Label>
                <Input
                  type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 8 characters"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Branch</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch…" /></SelectTrigger>
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
                <Label>Role *</Label>
                <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
                  <SelectContent>
                    {/* Operator roles — shown first and prominently */}
                    {operatorRoles.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          Operator (gets operator login page)
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
                          Admin / Other
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
                        No roles found — they will be created automatically
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {form.role_id && operatorRoles.some(r => r.id === form.role_id) && (
                  <p className="mt-1 text-xs text-blue-600">
                    This employee will log in at <strong>/operator</strong> and see their queue console
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.first_name || !form.email || !form.password || createMutation.isPending}
              >
                {createMutation.isPending ? "Adding…" : t("add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* No counters hint */}
      {counters.length === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Monitor className="inline mr-1.5 h-4 w-4" />
          No counters found for this branch. Create counters first so you can assign them to operators.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : employees.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No employees yet</p>
          <p className="mt-1 text-sm">Add your first staff member. Operators get a dedicated login page.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Window #</TableHead>
                <TableHead>Counter / Room</TableHead>
                <TableHead>Last login</TableHead>
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
                      {e.first_name} {e.last_name}
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
                          <span className="text-xs text-muted-foreground">No role</span>
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
                        <span className="text-xs text-muted-foreground italic">Assign counter first</span>
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
                              <SelectValue placeholder="Assign counter…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__unassigned__">— Unassigned —</SelectItem>
                              {counters.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">
                                  No counters — create them in Counters page
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

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {e.last_login_at ? new Date(e.last_login_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
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
      title="Click to set window number">
      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
      {value != null ? <span className="font-mono font-bold">{value}</span> : <span className="text-muted-foreground text-xs">Set #</span>}
    </button>
  );
}

// ── Inline reset-password button ──────────────────────────────────────────────
function ResetPasswordButton({ onReset, isPending }: { onReset: (pwd: string) => void; isPending: boolean }) {
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
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Reset password">
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Reset password</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Set a new password for this employee.</p>
          <div>
            <Label>New password</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder="Min 6 characters" className="mt-1"
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              autoFocus />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pwd.length < 6 || isPending}>
            {isPending ? "Saving…" : "Set password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

