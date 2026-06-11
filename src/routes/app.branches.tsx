import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Trash2, MapPin, Clock, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/branches")({ component: Branches });

function Branches() {
  const { branches, currentCompanyId, addBranch, removeBranch, setCurrentBranch } = useStore();
  const list = branches.filter((b) => b.companyId === currentCompanyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", phone: "", hours: "09:00 - 18:00" });

  return (
    <div>
      <PageHeader title="Branches" description="Physical locations for the current company" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New branch</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create branch</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {(["name", "address", "phone", "hours"] as const).map((k) => (
                <div key={k}><Label className="capitalize">{k}</Label><Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
              ))}
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentCompanyId) return toast.error("Select a company");
              if (!form.name) return toast.error("Name required");
              addBranch({ companyId: currentCompanyId, ...form });
              toast.success("Branch created"); setOpen(false);
              setForm({ name: "", address: "", phone: "", hours: "09:00 - 18:00" });
            }}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No branches" /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <Card key={b.id}>
              <CardHeader><CardTitle className="flex items-center justify-between">{b.name}
                <Button variant="ghost" size="icon" onClick={() => { removeBranch(b.id); toast.success("Removed"); }}><Trash2 className="h-4 w-4" /></Button>
              </CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{b.address || "—"}</div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4" />{b.phone || "—"}</div>
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{b.hours}</div>
                <Button size="sm" variant="outline" onClick={() => { setCurrentBranch(b.id); toast.success(`Switched to ${b.name}`); }}>Set active</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
