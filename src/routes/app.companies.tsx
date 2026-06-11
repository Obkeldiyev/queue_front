import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/companies")({ component: Companies });

function Companies() {
  const { companies, branches, addCompany, removeCompany, setCurrentCompany } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Tenants on the platform"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New company</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create company</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Banking, Clinic, Restaurant…" /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  if (!name) return toast.error("Name required");
                  const c = addCompany({ name, industry });
                  setCurrentCompany(c.id);
                  toast.success("Company created");
                  setName(""); setIndustry(""); setOpen(false);
                }}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {companies.length === 0 ? <EmptyState title="No companies yet" hint="Create your first company to get started." /> : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Card key={c.id}>
              <CardHeader><CardTitle className="flex items-center justify-between">{c.name}
                <Button variant="ghost" size="icon" onClick={() => { removeCompany(c.id); toast.success("Deleted"); }}><Trash2 className="h-4 w-4" /></Button>
              </CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>Industry: <span className="text-foreground">{c.industry || "—"}</span></div>
                <div>Branches: <span className="text-foreground">{branches.filter((b) => b.companyId === c.id).length}</span></div>
                <Button size="sm" variant="outline" onClick={() => { setCurrentCompany(c.id); toast.success(`Switched to ${c.name}`); }}>Set active</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
