import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Plus, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tickets")({
  beforeLoad: requireCompanyAdmin,
  component: TicketTemplates,
});

interface TicketTemplate {
  id: string; company_id: string; name: string;
  header_text?: string; footer_text?: string;
  show_qr: boolean; show_barcode: boolean;
  show_logo: boolean; show_wait_time: boolean;
  show_counter: boolean;
}

function TicketTemplates() {
  const { user } = useAuthStore();
  const { currentCompanyId } = useStore();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["ticket-templates", companyId],
    queryFn: () =>
      api.get<TicketTemplate[]>(`/ticket-templates?company_id=${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TicketTemplate | null>(null);
  const [form, setForm] = useState<Partial<TicketTemplate>>({
    name: "Default",
    header_text: "{{company_name}} — {{branch_name}}",
    footer_text: "Thank you for your visit!",
    show_qr: true, show_barcode: false, show_logo: true,
    show_wait_time: true, show_counter: true,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post<TicketTemplate>("/ticket-templates", { ...form, company_id: companyId }),
    onSuccess: () => {
      toast.success("Template created");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["ticket-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const updateMutation = useMutation({
    mutationFn: () => api.patch<TicketTemplate>(`/ticket-templates/${selected!.id}`, form),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["ticket-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/ticket-templates/${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      if (selected?.id === templates[0]?.id) setSelected(null);
      void qc.invalidateQueries({ queryKey: ["ticket-templates"] });
    },
  });

  const openEdit = (t: TicketTemplate) => {
    setSelected(t);
    setForm({
      name: t.name, header_text: t.header_text, footer_text: t.footer_text,
      show_qr: t.show_qr, show_barcode: t.show_barcode, show_logo: t.show_logo,
      show_wait_time: t.show_wait_time, show_counter: t.show_counter,
    });
  };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ticket Templates</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Customise what prints on the receipt — logo, QR code, wait time, window number.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" />New template</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create ticket template</DialogTitle></DialogHeader>
            <TemplateForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        {/* Template list */}
        <div className="space-y-1">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />)
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">
              <Ticket className="mx-auto mb-2 h-6 w-6 opacity-30" />
              No templates
            </div>
          ) : (
            templates.map((t) => (
              <button key={t.id}
                onClick={() => openEdit(t)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${selected?.id === t.id ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"}`}>
                <span className="truncate">{t.name}</span>
                <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete?")) deleteMutation.mutate(t.id); }}
                  className="ml-2 rounded p-0.5 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Edit panel */}
        {selected ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Edit: {selected.name}</CardTitle>
              <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </CardHeader>
            <CardContent>
              <TemplateForm form={form} setForm={setForm} />
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
            <Ticket className="mx-auto mb-3 h-8 w-8 opacity-30" />
            <p>Select a template to edit it</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateForm({ form, setForm }: {
  form: Partial<TicketTemplate>;
  setForm: React.Dispatch<React.SetStateAction<Partial<TicketTemplate>>>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Template name *</Label>
        <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
      </div>
      <div>
        <Label>Header text <span className="text-xs text-muted-foreground">supports {"{{company_name}}, {{branch_name}}, {{date}}"}</span></Label>
        <Input value={form.header_text ?? ""} onChange={(e) => setForm({ ...form, header_text: e.target.value })} className="mt-1 font-mono text-sm" />
      </div>
      <div>
        <Label>Footer text</Label>
        <Input value={form.footer_text ?? ""} onChange={(e) => setForm({ ...form, footer_text: e.target.value })} className="mt-1 font-mono text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {([
          ["show_logo",      "Show logo"],
          ["show_qr",        "Show QR code"],
          ["show_barcode",   "Show barcode"],
          ["show_wait_time", "Show wait time"],
          ["show_counter",   "Show window number"],
        ] as [keyof TicketTemplate, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center gap-2.5 rounded-lg border p-3">
            <Switch
              checked={!!form[key]}
              onCheckedChange={(v) => setForm({ ...form, [key]: v })}
            />
            <Label className="text-sm cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}

