import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/employees")({ component: Employees });

const ROLES = ["manager", "supervisor", "operator", "viewer"] as const;

function Employees() {
  const { employees, branches, currentCompanyId, addEmployee, removeEmployee, updateEmployee } = useStore();
  const list = employees.filter((e) => e.companyId === currentCompanyId);
  const companyBranches = branches.filter((b) => b.companyId === currentCompanyId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; role: typeof ROLES[number]; branchId?: string }>({ name: "", email: "", role: "operator" });

  return (
    <div>
      <PageHeader title="Employees" description="Roles & permissions" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />New employee</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create employee</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as typeof ROLES[number] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Branch</Label>
                <Select value={form.branchId ?? ""} onValueChange={(v) => setForm({ ...form, branchId: v })}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{companyBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentCompanyId || !form.name) return toast.error("Fill in details");
              addEmployee({ companyId: currentCompanyId, ...form });
              toast.success("Created"); setOpen(false);
              setForm({ name: "", email: "", role: "operator" });
            }}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No employees" /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Branch</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-muted-foreground">{e.email}</TableCell>
                  <TableCell>
                    <Select value={e.role} onValueChange={(v) => updateEmployee(e.id, { role: v as typeof ROLES[number] })}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{companyBranches.find((b) => b.id === e.branchId)?.name ?? "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeEmployee(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
