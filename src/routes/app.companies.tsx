import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore, getUserFromStorage } from "@/lib/auth-store";
import { useLang } from "@/lib/i18n";
import { companiesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import {
  Plus, Trash2, Building2, LogOut, Shield, MoreVertical, GitBranch, Users, Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { useLang as useLangInner, LANGS } from "@/lib/i18n";

export const Route = createFileRoute("/app/companies")({
  // Only platform users (super admin) can see this page
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const user = getUserFromStorage();
    const token = localStorage.getItem("qms_access_token");
    const refresh = localStorage.getItem("qms_refresh_token");
    if (!token && !user && !refresh) throw redirect({ to: "/login" as any });
    if (user?.type === "company_user") throw redirect({ to: "/app" as any });
  },
  component: SuperAdminCompanies,
});

function SuperAdminCompanies() {
  const { user, logout } = useAuthStore();
  const { t, lang, setLang } = useLang();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", phone: "", email: "", address: "",
    admin_first_name: "", admin_last_name: "", admin_email: "", admin_password: "",
  });

  // Load all companies (super admin sees all)
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies-all"],
    queryFn: () => companiesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      // 1. Create company
      const comp = await companiesApi.create({
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
      }).then((r) => r.data);

      // 2. Create company admin user via employees API
      if (form.admin_email && form.admin_password) {
        const { employeesApi } = await import("@/lib/api");
        await employeesApi.create({
          company_id: comp.id,
          first_name: form.admin_first_name || "Admin",
          last_name: form.admin_last_name || "User",
          email: form.admin_email,
          password: form.admin_password,
          // No role_ids → backend assigns COMPANY_ADMIN by default when no roles given,
          // or we let ensureDefaultCompanyRoles handle it.
        });
      }

      return comp;
    },
    onSuccess: () => {
      toast.success("Company created with admin account");
      setOpen(false);
      setForm({ name: "", slug: "", phone: "", email: "", address: "", admin_first_name: "", admin_last_name: "", admin_email: "", admin_password: "" });
      void qc.invalidateQueries({ queryKey: ["companies-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error creating company"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => companiesApi.delete(id),
    onSuccess: () => {
      toast.success("Company deleted");
      void qc.invalidateQueries({ queryKey: ["companies-all"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const STATUS_COLOR: Record<string, string> = {
    ACTIVE:   "border-green-300 text-green-700",
    TRIAL:    "border-amber-300 text-amber-700",
    INACTIVE: "border-slate-300 text-slate-400",
    SUSPENDED:"border-red-300 text-red-700",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Super-admin top bar */}
      <header className="flex h-14 items-center gap-3 border-b bg-card px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white font-black text-sm">
          Q
        </div>
        <div>
          <span className="font-bold text-sm">Qubit QMS</span>
          <span className="ml-2 text-xs text-muted-foreground">— Platform Admin</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Language toggle */}
          <div className="flex gap-0.5 rounded-lg border p-0.5">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {l.code.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <Shield className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-medium">{user?.first_name} {user?.last_name}</span>
          </div>

          <Button variant="ghost" size="sm" onClick={() => void handleLogout()} className="gap-1.5 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">
        {/* Page header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold">Companies</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              All tenants on the platform. Each company gets their own admin, branches, and queues.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1.5 h-4 w-4" /> New company
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create company</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Company details */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ABC Bank" className="mt-1" />
                    </div>
                    <div>
                      <Label>Slug <span className="text-muted-foreground text-xs">(URL key)</span></Label>
                      <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="abc-bank" className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Admin account */}
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Company admin account <span className="text-blue-500">(optional)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>First name</Label>
                      <Input value={form.admin_first_name} onChange={(e) => setForm({ ...form, admin_first_name: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                      <Label>Last name</Label>
                      <Input value={form.admin_last_name} onChange={(e) => setForm({ ...form, admin_last_name: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label>Admin email</Label>
                    <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} className="mt-1" placeholder="admin@company.com" />
                  </div>
                  <div>
                    <Label>Admin password</Label>
                    <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} className="mt-1" placeholder="Min 8 characters" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!form.name || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating…" : "Create company"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {[
            { label: "Total companies", value: companies.length },
            { label: "Active",   value: companies.filter((c) => c.status === "ACTIVE").length },
            { label: "Trial",    value: companies.filter((c) => c.status === "TRIAL").length },
            { label: "Suspended",value: companies.filter((c) => c.status === "SUSPENDED").length },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border bg-card p-4 text-center">
              <p className="text-2xl font-black">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Company grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-dashed p-16 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-10 w-10 opacity-25" />
            <p className="font-medium">No companies yet</p>
            <p className="mt-1 text-sm">Create the first company to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Card key={c.id} className="relative">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                        {c.name[0]?.toUpperCase()}
                      </div>
                      <span className="truncate">{c.name}</span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            if (confirm(`Delete "${c.name}" and all its data? This cannot be undone.`)) {
                              deleteMutation.mutate(c.id);
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete company
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLOR[c.status] ?? "border-slate-300 text-slate-400"}`}
                    >
                      {c.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{c.slug}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {[
                      { icon: GitBranch, label: "Branches", val: c._count?.branches ?? 0 },
                      { icon: Users,     label: "Users",    val: c._count?.users    ?? 0 },
                      { icon: Cpu,       label: "Devices",  val: c._count?.devices  ?? 0 },
                    ].map(({ icon: Icon, label, val }) => (
                      <div key={label} className="rounded-lg bg-muted/50 p-2">
                        <Icon className="mx-auto mb-1 h-3.5 w-3.5 text-muted-foreground" />
                        <p className="font-bold">{val}</p>
                        <p className="text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {c.email && (
                    <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

