import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState, StatusBadge } from "@/components/qms/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Order } from "@/lib/store";

export const Route = createFileRoute("/app/orders")({ component: Orders });

const STATUSES: Order["status"][] = ["pending", "accepted", "preparing", "ready", "completed", "cancelled"];

function Orders() {
  const { orders, currentBranchId, updateOrderStatus } = useStore();
  const list = orders.filter((o) => o.branchId === currentBranchId).slice().reverse();
  return (
    <div>
      <PageHeader title="Online Orders" description="Manage incoming online orders" />
      {list.length === 0 ? <EmptyState title="No orders yet" hint="Place an order from the Customer App to see it here." /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-bold">{o.number}</TableCell>
                  <TableCell className="text-muted-foreground">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</TableCell>
                  <TableCell>${o.total.toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={o.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleTimeString()}</TableCell>
                  <TableCell>
                    <Select value={o.status} onValueChange={(v) => updateOrderStatus(o.id, v as Order["status"])}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
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
