import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang, loc } from "@/lib/i18n";
import { servicesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/services")({
  beforeLoad: requireCompanyAdmin,
  component: Services,
});

function Services() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services", companyId],
    queryFn: () =>
      servicesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name_uz: "", name_ru: "", name_en: "",
    description_uz: "", estimated_time_mins: 10, prefix: "A",
  });

  const createMutation = useMutation({
    mutationFn: () =>
      servicesApi.create({
        company_id: companyId,
        ...(currentBranchId && { branch_id: currentBranchId }),
        name_uz: form.name_uz,
        name_ru: form.name_ru || undefined,
        name_en: form.name_en || undefined,
        description_uz: form.description_uz || undefined,
        estimated_time_mins: form.estimated_time_mins,
      }),
    onSuccess: () => {
      toast.success("Service created");
      setOpen(false);
      setForm({ name_uz: "", name_ru: "", name_en: "", description_uz: "", estimated_time_mins: 10, prefix: "A" });
      void qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      toast.success("Service deleted");
      void qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">What this company offers in its queues</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />New service</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create service</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Name (UZ) *</Label>
                  <Input value={form.name_uz} onChange={(e) => setForm({ ...form, name_uz: e.target.value })} className="mt-1" placeholder="Kreditlar" />
                </div>
                <div>
                  <Label>Name (RU)</Label>
                  <Input value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className="mt-1" placeholder="Кредиты" />
                </div>
                <div>
                  <Label>Name (EN)</Label>
                  <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className="mt-1" placeholder="Loans" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description_uz} onChange={(e) => setForm({ ...form, description_uz: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Avg. service time (minutes)</Label>
                <Input type="number" min={1} value={form.estimated_time_mins}
                  onChange={(e) => setForm({ ...form, estimated_time_mins: +e.target.value })} className="mt-1" />
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
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : services.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Layers className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No services yet</p>
          <p className="mt-1 text-sm">Create services first, then link them to queues.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Avg. Time</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {loc(s as unknown as Record<string, unknown>, "name", lang) || s.name_uz}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {loc(s as unknown as Record<string, unknown>, "description", lang) || s.description_uz || "—"}
                  </TableCell>
                  <TableCell>
                    {s.estimated_time_mins ? (
                      <Badge variant="secondary">{s.estimated_time_mins} min</Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm("Delete this service?")) deleteMutation.mutate(s.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

