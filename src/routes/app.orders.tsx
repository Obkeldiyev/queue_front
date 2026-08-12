import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { requireCompanyAdmin } from "@/lib/guards";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/orders")({
  beforeLoad: requireCompanyAdmin,
  component: Orders,
});

const ORDER_STATUSES = ["PENDING","ACCEPTED","PREPARING","READY","COMPLETED","CANCELLED"] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING:   "border-amber-300 text-amber-700",
  ACCEPTED:  "border-blue-300 text-blue-700",
  PREPARING: "border-purple-300 text-purple-700",
  READY:     "border-cyan-300 text-cyan-700",
  COMPLETED: "border-green-300 text-green-700",
  CANCELLED: "border-red-300 text-red-700",
};

interface OrderItem { product_name: string; quantity: number; unit_price: number }
interface OrderRecord {
  id: string; order_number: string; status: OrderStatus;
  total_amount: number; created_at: string;
  items?: OrderItem[];
  customer?: { first_name?: string; last_name?: string; phone?: string };
}

function Orders() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", companyId, currentBranchId],
    queryFn: () =>
      api.get<OrderRecord[]>(`/orders?${new URLSearchParams({
        ...(companyId && { company_id: companyId }),
        ...(currentBranchId && { branch_id: currentBranchId }),
      }).toString()}`).then((r) => r.data),
    enabled: !!companyId,
    refetchInterval: 10_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}`, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Online Orders</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Incoming orders — refreshes every 10 s</p>
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No orders yet</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-bold">{o.order_number}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.customer ? `${o.customer.first_name ?? ""} ${o.customer.last_name ?? ""}`.trim() || o.customer.phone || "—" : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {(o.items ?? []).map((i) => `${i.quantity}× ${i.product_name}`).join(", ") || "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {o.total_amount?.toLocaleString()} UZS
                  </TableCell>
                  <TableCell>
                    <Select
                      value={o.status}
                      onValueChange={(v) => updateMutation.mutate({ id: o.id, status: v as OrderStatus })}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <Badge variant="outline" className={`text-xs ${STATUS_COLOR[o.status] ?? ""}`}>
                          {o.status}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleTimeString()}
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

