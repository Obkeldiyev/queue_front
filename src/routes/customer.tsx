import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, EmptyState } from "@/components/qms/ui";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Minus, ShoppingBag, Ticket as TicketIcon, MapPin, Bell, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/customer")({
  head: () => ({ meta: [{ title: "Customer App — Qubit" }] }),
  component: Customer,
});

const MENU = [
  { name: "Espresso", price: 2.5 },
  { name: "Cappuccino", price: 3.5 },
  { name: "Latte", price: 4.0 },
  { name: "Croissant", price: 2.0 },
  { name: "Sandwich", price: 5.5 },
  { name: "Salad", price: 6.0 },
];

function Customer() {
  const { companies, branches, queues, services, tickets, currentCompanyId, currentBranchId, setCurrentBranch, issueTicket, placeOrder, orders, notifications, noShow } = useStore();
  const company = companies.find((c) => c.id === currentCompanyId);
  const companyBranches = branches.filter((b) => b.companyId === currentCompanyId);
  const branchQueues = queues.filter((q) => q.branchId === currentBranchId && q.online);
  const myTickets = tickets.filter((t) => t.source === "online").slice().reverse();
  const myOrders = orders.filter((o) => o.branchId === currentBranchId).slice().reverse();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([n, qty]) => ({ name: n, qty, price: MENU.find((m) => m.name === n)!.price }));
  const cartTotal = cartItems.reduce((a, b) => a + b.qty * b.price, 0);

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/"><ArrowLeft className="h-5 w-5 text-muted-foreground" /></Link>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{company?.name}</div>
            <div className="text-sm font-semibold">{branches.find((b) => b.id === currentBranchId)?.name}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Select value={currentBranchId} onValueChange={setCurrentBranch}>
              <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Branch" /></SelectTrigger>
              <SelectContent>{companyBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <Tabs defaultValue="queue">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="queue"><TicketIcon className="mr-1 h-4 w-4" />Queue</TabsTrigger>
            <TabsTrigger value="order"><ShoppingBag className="mr-1 h-4 w-4" />Order</TabsTrigger>
            <TabsTrigger value="tickets">My tickets</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>Take an online ticket</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                <div className="grid gap-2 sm:grid-cols-2">
                  {branchQueues.map((q) => {
                    const svc = services.find((s) => s.id === q.serviceId);
                    const ahead = tickets.filter((t) => t.queueId === q.id && t.status === "waiting").length;
                    return (
                      <button key={q.id} onClick={() => { const t = issueTicket({ queueId: q.id, source: "online", customerName: name }); if (t) toast.success(`Got ticket ${t.number}`); }} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary">
                        <div className="font-semibold">{q.name}</div>
                        <div className="text-xs text-muted-foreground">{svc?.description}</div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">~{(svc?.avgTime ?? 10) * (ahead + 1)} min wait</span>
                          <span className="rounded-full bg-secondary px-2 py-0.5">{ahead} ahead</span>
                        </div>
                      </button>
                    );
                  })}
                  {branchQueues.length === 0 && <div className="col-span-full text-sm text-muted-foreground">No online queues available.</div>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-4 w-4" />Branch info</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {branches.find((b) => b.id === currentBranchId)?.address} · {branches.find((b) => b.id === currentBranchId)?.hours}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="order" className="mt-4 space-y-4">
            <Card>
              <CardHeader><CardTitle>Menu</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {MENU.map((m) => (
                  <div key={m.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">${m.price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="outline" onClick={() => setCart({ ...cart, [m.name]: Math.max(0, (cart[m.name] ?? 0) - 1) })}><Minus className="h-3 w-3" /></Button>
                      <span className="w-6 text-center font-mono">{cart[m.name] ?? 0}</span>
                      <Button size="icon" onClick={() => setCart({ ...cart, [m.name]: (cart[m.name] ?? 0) + 1 })}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            {cartItems.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Cart · ${cartTotal.toFixed(2)}</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-3 space-y-1 text-sm">
                    {cartItems.map((i) => <div key={i.name} className="flex justify-between"><span>{i.qty}× {i.name}</span><span>${(i.qty * i.price).toFixed(2)}</span></div>)}
                  </div>
                  <Button className="w-full" onClick={() => {
                    if (!currentBranchId) return;
                    const o = placeOrder({ branchId: currentBranchId, items: cartItems });
                    toast.success(`Order ${o.number} placed`);
                    setCart({});
                  }}>Place order · ${cartTotal.toFixed(2)}</Button>
                </CardContent>
              </Card>
            )}
            {myOrders.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">My orders</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {myOrders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <div className="font-bold">{o.number}</div>
                        <div className="text-xs text-muted-foreground">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                      </div>
                      <StatusBadge status={o.status} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tickets" className="mt-4 space-y-3">
            {myTickets.length === 0 ? <EmptyState title="No tickets yet" hint="Take an online ticket from the Queue tab." /> : myTickets.map((t) => {
              const q = queues.find((x) => x.id === t.queueId);
              const ahead = tickets.filter((x) => x.queueId === t.queueId && x.status === "waiting" && x.createdAt < t.createdAt).length;
              return (
                <Card key={t.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">{q?.name}</div>
                        <div className="text-5xl font-black text-primary">{t.number}</div>
                        {t.customerName && <div className="text-xs text-muted-foreground">For {t.customerName}</div>}
                      </div>
                      <StatusBadge status={t.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-secondary p-2"><div className="text-muted-foreground">Ahead</div><div className="text-base font-bold">{ahead}</div></div>
                      <div className="rounded-lg bg-secondary p-2"><div className="text-muted-foreground">Est. wait</div><div className="text-base font-bold">{ahead * 8}m</div></div>
                      <div className="rounded-lg bg-secondary p-2"><div className="text-muted-foreground">Source</div><div className="text-base font-bold">{t.source}</div></div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success("Arrival confirmed via QR")}><ScanLine className="mr-1 h-4 w-4" />Confirm arrival</Button>
                      <Button size="sm" variant="outline" onClick={() => { noShow(t.id); toast.success("Cancelled"); }}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="alerts" className="mt-4 space-y-2">
            {notifications.length === 0 ? <EmptyState title="No alerts" /> : notifications.map((n) => (
              <div key={n.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm text-muted-foreground">{n.body}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(n.at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
