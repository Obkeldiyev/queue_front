import { createFileRoute } from "@tanstack/react-router";
import { useStore, type Device } from "@/lib/store";
import { PageHeader, EmptyState, StatusBadge } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { Plus, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/devices")({ component: Devices });

const TYPES: Device["type"][] = ["kiosk", "printer", "display", "counter-display", "keyboard", "qr-scanner", "media"];

function Devices() {
  const { devices, currentBranchId, addDevice, removeDevice, toggleDevice } = useStore();
  const list = devices.filter((d) => d.branchId === currentBranchId);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; type: Device["type"]; ip: string }>({ name: "", type: "kiosk", ip: "" });

  return (
    <div>
      <PageHeader title="Devices" description="Kiosks, printers, displays and scanners" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Register device</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register device</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Device["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>IP address</Label><Input value={form.ip} onChange={(e) => setForm({ ...form, ip: e.target.value })} placeholder="10.0.0.42" /></div>
            </div>
            <DialogFooter><Button onClick={() => {
              if (!currentBranchId || !form.name) return toast.error("Fill details");
              addDevice({ branchId: currentBranchId, status: "online", ...form });
              toast.success("Device registered"); setOpen(false);
              setForm({ name: "", type: "kiosk", ip: "" });
            }}>Register</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      {list.length === 0 ? <EmptyState title="No devices" /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>IP</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><code className="rounded bg-muted px-1.5">{d.type}</code></TableCell>
                  <TableCell className="text-muted-foreground">{d.ip}</TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleDevice(d.id)} title="Toggle"><Power className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => removeDevice(d.id)}><Trash2 className="h-4 w-4" /></Button>
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
