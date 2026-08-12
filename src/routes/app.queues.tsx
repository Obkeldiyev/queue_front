import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { queuesApi, servicesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, ListOrdered, Hash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/queues")({
  beforeLoad: requireCompanyAdmin,
  component: Queues,
});

function Queues() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";
  const branchId = currentBranchId ?? "";

  const { data: queues = [], isLoading } = useQuery({
    queryKey: ["queues", companyId, branchId],
    queryFn: () =>
      queuesApi.list({
        ...(companyId && { company_id: companyId }),
        ...(branchId && { branch_id: branchId }),
      }).then((r) => r.data),
    enabled: !!companyId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", companyId],
    queryFn: () => servicesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name_uz: "", name_ru: "", name_en: "",
    prefix: "A", service_id: "",
    online_enabled: false, daily_limit: 200,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      queuesApi.create({
        branch_id: branchId,
        name_uz: form.name_uz,
        name_ru: form.name_ru || undefined,
        name_en: form.name_en || undefined,
        prefix: form.prefix,
        service_id: form.service_id || undefined,
        online_enabled: form.online_enabled,
        daily_limit: form.daily_limit,
      }),
    onSuccess: () => {
      toast.success("Queue created");
      setOpen(false);
      setForm({ name_uz: "", name_ru: "", name_en: "", prefix: "A", service_id: "", online_enabled: false, daily_limit: 200 });
      void qc.invalidateQueries({ queryKey: ["queues"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => queuesApi.delete(id),
    onSuccess: () => {
      toast.success("Queue deleted");
      void qc.invalidateQueries({ queryKey: ["queues"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      queuesApi.update(id, { is_active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["queues"] }),
  });

  if (!branchId) return (
    <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
      Select a branch from the header to manage queues.
    </div>
  );

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Queue Designer</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Create queues for each service. Each queue issues numbered tickets.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />New queue</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create queue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Name (UZ) *</Label>
                  <Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} className="mt-1" placeholder="Umumiy navbat" />
                </div>
                <div>
                  <Label>Name (RU)</Label>
                  <Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className="mt-1" placeholder="Общая очередь" />
                </div>
                <div>
                  <Label>Name (EN)</Label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="mt-1" placeholder="General Queue" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Prefix *</Label>
                  <Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().slice(0, 5) })} className="mt-1" maxLength={5} placeholder="A" />
                </div>
                <div>
                  <Label>Daily limit</Label>
                  <Input type="number" min={1} value={form.daily_limit}
                    onChange={(e) => setForm({ ...form, daily_limit: +e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Linked service (optional)</Label>
                <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="No service" /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {loc(s as unknown as Record<string, unknown>, "name", lang) || s.name_uz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.online_enabled} onCheckedChange={(v) => setForm({ ...form, online_enabled: v })} />
                <Label>Online queue enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name_uz || !form.prefix || createMutation.isPending}>
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
      ) : queues.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <ListOrdered className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No queues yet</p>
          <p className="mt-1 text-sm">Create queues to start issuing tickets from the kiosk.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queues.map((q) => (
            <Card key={q.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-black text-primary">
                      {q.prefix}
                    </span>
                    <span className="truncate">
                      {loc(q as unknown as Record<string, unknown>, "name", lang) || q.name_uz}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0"
                    onClick={() => { if (confirm("Delete this queue?")) deleteMutation.mutate(q.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {q.service && (
                  <p className="text-muted-foreground">
                    Service: {loc(q.service as unknown as Record<string, unknown>, "name", lang) || q.service.name_uz}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${q.is_active ? "border-green-300 text-green-700" : "border-slate-300 text-slate-400"}`}>
                    {q.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {q.online_enabled && <Badge variant="secondary" className="text-xs">Online</Badge>}
                  {q.daily_limit && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="h-3 w-3" />max {q.daily_limit}/day
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Switch
                    checked={q.is_active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: q.id, is_active: v })}
                  />
                  <Label className="text-xs text-muted-foreground">Active</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

