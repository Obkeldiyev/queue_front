import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/counters")({ component: Counters });

function Counters() {
  const { counters, queues, employees, currentBranchId, addCounter, removeCounter, updateCounter } = useStore();
  const list = counters.filter((c) => c.branchId === currentBranchId);
  const branchQueues = queues.filter((q) => q.branchId === currentBranchId);
  const branchOps = employees.filter((e) => e.branchId === currentBranchId && e.role === "operator");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [number, setNumber] = useState(1);
  return (
    <div>
      <PageHeader title="Counters" description="Assign queues and operators to counters" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New counter</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New counter</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label>Number</Label><Input type="number" value={number} onChange={(e) => setNumber(+e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentBranchId) return toast.error("Select branch");
              addCounter({ branchId: currentBranchId, name: name || `Counter ${number}`, number, queueIds: [] });
              toast.success("Counter created"); setOpen(false); setName(""); setNumber(number + 1);
            }}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No counters in this branch" /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id}>
              <CardHeader><CardTitle className="flex items-center justify-between">{c.name}
                <Button variant="ghost" size="icon" onClick={() => removeCounter(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <Label className="text-xs text-muted-foreground">Queues</Label>
                  <div className="mt-1 space-y-1">
                    {branchQueues.map((q) => (
                      <label key={q.id} className="flex items-center gap-2">
                        <Checkbox checked={c.queueIds.includes(q.id)} onCheckedChange={(v) => {
                          const ids = v ? [...c.queueIds, q.id] : c.queueIds.filter((x) => x !== q.id);
                          updateCounter(c.id, { queueIds: ids });
                        }} />
                        <span>{q.name}</span>
                      </label>
                    ))}
                    {branchQueues.length === 0 && <div className="text-xs text-muted-foreground">No queues yet</div>}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Operator</Label>
                  <Select value={c.operatorId ?? ""} onValueChange={(v) => updateCounter(c.id, { operatorId: v })}>
                    <SelectTrigger><SelectValue placeholder="Assign operator" /></SelectTrigger>
                    <SelectContent>{branchOps.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
