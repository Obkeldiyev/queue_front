import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/queues")({ component: Queues });

function Queues() {
  const { queues, services, currentCompanyId, currentBranchId, addQueue, removeQueue, updateQueue } = useStore();
  const list = queues.filter((q) => q.companyId === currentCompanyId && (!currentBranchId || q.branchId === currentBranchId));
  const companyServices = services.filter((s) => s.companyId === currentCompanyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", prefix: "A", format: "A{000}", serviceId: "", online: true, dailyLimit: 200 });

  return (
    <div>
      <PageHeader title="Queue Designer" description="Unlimited queues with custom number formats" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New queue</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New queue</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prefix</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} /></div>
                <div><Label>Format</Label><Input value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} /></div>
              </div>
              <div className="text-xs text-muted-foreground">Use <code>{"{000}"}</code> or <code>{"{0000}"}</code> for numeric placeholders. Example: <code>VIP-{"{0000}"}</code></div>
              <div><Label>Service</Label>
                <Select value={form.serviceId} onValueChange={(v) => setForm({ ...form, serviceId: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a service" /></SelectTrigger>
                  <SelectContent>{companyServices.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between"><Label>Available online</Label><Switch checked={form.online} onCheckedChange={(v) => setForm({ ...form, online: v })} /></div>
              <div><Label>Daily limit</Label><Input type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: +e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentCompanyId || !currentBranchId) return toast.error("Select company & branch");
              if (!form.name || !form.serviceId) return toast.error("Fill required fields");
              addQueue({ companyId: currentCompanyId, branchId: currentBranchId, counter: 0, ...form });
              toast.success("Queue created"); setOpen(false);
              setForm({ name: "", prefix: "A", format: "A{000}", serviceId: "", online: true, dailyLimit: 200 });
            }}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No queues" hint="Create your first queue to start issuing tickets." /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((q) => {
            const svc = services.find((s) => s.id === q.serviceId);
            return (
              <Card key={q.id}>
                <CardHeader><CardTitle className="flex items-center justify-between">
                  {q.name}
                  <Button variant="ghost" size="icon" onClick={() => removeQueue(q.id)}><Trash2 className="h-4 w-4" /></Button>
                </CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-muted-foreground">Service: <span className="text-foreground">{svc?.name ?? "—"}</span></div>
                  <div className="text-muted-foreground">Format: <code className="rounded bg-muted px-1.5">{q.format}</code></div>
                  <div className="text-muted-foreground">Daily limit: {q.dailyLimit}</div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-muted-foreground">Online</span>
                    <Switch checked={q.online} onCheckedChange={(v) => updateQueue(q.id, { online: v })} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
