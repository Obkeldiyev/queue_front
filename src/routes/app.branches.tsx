import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { branchesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, MapPin, Clock, Phone, GitBranch } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/branches")({
  beforeLoad: requireCompanyAdmin,
  component: Branches,
});

function Branches() {
  const { user } = useAuthStore();
  const { currentCompanyId, setCurrentBranch } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name_uz: "", name_ru: "", name_en: "",
    address: "", phone: "", working_hours: "09:00 - 18:00",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      branchesApi.create({
        company_id: companyId,
        name_uz: form.name_uz,
        name_ru: form.name_ru || undefined,
        name_en: form.name_en || undefined,
        address_uz: form.address || undefined,
        phone: form.phone || undefined,
      }),
    onSuccess: (res) => {
      toast.success("Branch created");
      setCurrentBranch(res.data.id);
      setOpen(false);
      setForm({ name_uz: "", name_ru: "", name_en: "", address: "", phone: "", working_hours: "09:00 - 18:00" });
      void qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      toast.success("Branch deleted");
      void qc.invalidateQueries({ queryKey: ["branches"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!companyId) return (
    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Select a company first.</div>
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Physical locations for this company</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />New branch</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Name (UZ) *</Label>
                  <Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} placeholder="Bosh filial" className="mt-1" />
                </div>
                <div>
                  <Label>Name (RU)</Label>
                  <Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} placeholder="Главный филиал" className="mt-1" />
                </div>
                <div>
                  <Label>Name (EN)</Label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} placeholder="Main Branch" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name_uz || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <GitBranch className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No branches yet</p>
          <p className="mt-1 text-sm">Create the first branch to start managing queues.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => (
            <Card key={b.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="truncate">{loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => { if (confirm("Delete this branch?")) deleteMutation.mutate(b.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {b.address_uz && <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.address_uz}</span></div>}
                {b.phone && <div className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{b.phone}</div>}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className={`text-xs ${b.status === "ACTIVE" ? "border-green-300 text-green-700" : "border-slate-300 text-slate-400"}`}>{b.status}</Badge>
                  <Button size="sm" variant="outline" className="ml-auto h-7 text-xs"
                    onClick={() => { setCurrentBranch(b.id); toast.success(`Switched to ${b.name_uz}`); }}>
                    Set active
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

