import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/services")({ component: Services });

function Services() {
  const { services, currentCompanyId, addService, removeService } = useStore();
  const list = services.filter((s) => s.companyId === currentCompanyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", avgTime: 10, priority: 1, prefix: "S" });
  return (
    <div>
      <PageHeader title="Services" description="What this company offers" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New service</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create service</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div><Label>Avg time (min)</Label><Input type="number" value={form.avgTime} onChange={(e) => setForm({ ...form, avgTime: +e.target.value })} /></div>
              <div><Label>Priority (0=highest)</Label><Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} /></div>
              <div><Label>Prefix</Label><Input value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase().slice(0, 4) })} /></div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentCompanyId) return toast.error("No company");
              if (!form.name) return toast.error("Name required");
              addService({ companyId: currentCompanyId, ...form });
              toast.success("Service added"); setOpen(false);
              setForm({ name: "", description: "", avgTime: 10, priority: 1, prefix: "S" });
            }}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No services" /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Prefix</TableHead><TableHead>Avg time</TableHead><TableHead>Priority</TableHead><TableHead>Description</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5 py-0.5">{s.prefix}</code></TableCell>
                  <TableCell>{s.avgTime} min</TableCell>
                  <TableCell>{s.priority}</TableCell>
                  <TableCell className="text-muted-foreground">{s.description}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeService(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
