import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/tickets")({ component: TicketTemplates });

function renderTemplate(s: string, vars: Record<string, string>) {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function TicketTemplates() {
  const { ticketTemplates, currentCompanyId, companies, branches, currentBranchId, addTicketTemplate, updateTicketTemplate, removeTicketTemplate } = useStore();
  const list = ticketTemplates.filter((t) => t.companyId === currentCompanyId);
  const [selected, setSelected] = useState<string | undefined>(list[0]?.id);
  const tpl = list.find((t) => t.id === selected) ?? list[0];
  const company = companies.find((c) => c.id === currentCompanyId);
  const branch = branches.find((b) => b.id === currentBranchId);

  const vars: Record<string, string> = {
    company_name: company?.name ?? "",
    branch_name: branch?.name ?? "",
    queue_number: "A105",
    service_name: "Loans",
    counter: "2",
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString(),
    estimated_wait_time: "12 min",
  };

  return (
    <div>
      <PageHeader title="Ticket Templates" description="Design what gets printed on every ticket" actions={
        <Button onClick={() => { if (!currentCompanyId) return; const t = addTicketTemplate({ companyId: currentCompanyId, name: `Template ${list.length + 1}`, header: "{{company_name}}", footer: "Thank you", showQR: true, showBarcode: false }); setSelected(t.id); }}>
          <Plus className="mr-1 h-4 w-4" />New template
        </Button>
      } />
      {list.length === 0 ? <EmptyState title="No templates" /> : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_360px]">
          <Card>
            <CardHeader><CardTitle className="text-sm">Templates</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {list.map((t) => (
                <button key={t.id} onClick={() => setSelected(t.id)} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${tpl?.id === t.id ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                  <span>{t.name}</span>
                  <Trash2 className="h-3 w-3" onClick={(e) => { e.stopPropagation(); removeTicketTemplate(t.id); }} />
                </button>
              ))}
            </CardContent>
          </Card>

          {tpl && <>
            <Card>
              <CardHeader><CardTitle className="text-sm">Editor</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Name</Label><Input value={tpl.name} onChange={(e) => updateTicketTemplate(tpl.id, { name: e.target.value })} /></div>
                <div><Label>Header (supports variables)</Label><Input value={tpl.header} onChange={(e) => updateTicketTemplate(tpl.id, { header: e.target.value })} /></div>
                <div><Label>Footer</Label><Input value={tpl.footer} onChange={(e) => updateTicketTemplate(tpl.id, { footer: e.target.value })} /></div>
                <div className="flex items-center justify-between"><Label>Show QR code</Label><Switch checked={tpl.showQR} onCheckedChange={(v) => updateTicketTemplate(tpl.id, { showQR: v })} /></div>
                <div className="flex items-center justify-between"><Label>Show barcode</Label><Switch checked={tpl.showBarcode} onCheckedChange={(v) => updateTicketTemplate(tpl.id, { showBarcode: v })} /></div>
                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  Variables: {Object.keys(vars).map((k) => <code key={k} className="mr-1 rounded bg-background px-1">{`{{${k}}}`}</code>)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Live preview</CardTitle></CardHeader>
              <CardContent>
                <div className="mx-auto w-72 rounded-lg border-2 border-dashed bg-white p-4 font-mono text-xs text-black shadow-inner">
                  <div className="text-center text-base font-bold">{renderTemplate(tpl.header, vars)}</div>
                  <div className="my-2 border-t border-dashed" />
                  <div className="text-center">Queue Number</div>
                  <div className="text-center text-5xl font-black tracking-wider">{vars.queue_number}</div>
                  <div className="my-2 border-t border-dashed" />
                  <div className="flex justify-between"><span>Service</span><span>{vars.service_name}</span></div>
                  <div className="flex justify-between"><span>Counter</span><span>{vars.counter}</span></div>
                  <div className="flex justify-between"><span>Date</span><span>{vars.date}</span></div>
                  <div className="flex justify-between"><span>Time</span><span>{vars.time}</span></div>
                  <div className="flex justify-between"><span>Est. wait</span><span>{vars.estimated_wait_time}</span></div>
                  {tpl.showQR && <div className="mx-auto mt-3 grid h-20 w-20 grid-cols-8 gap-px bg-black p-1">{Array.from({ length: 64 }).map((_, i) => <div key={i} className={i * 7 % 3 ? "bg-white" : "bg-black"} />)}</div>}
                  {tpl.showBarcode && <div className="mt-2 flex h-10 items-end gap-px">{Array.from({ length: 40 }).map((_, i) => <div key={i} className="flex-1 bg-black" style={{ height: `${40 + (i % 5) * 12}%` }} />)}</div>}
                  <div className="mt-2 text-center text-[10px]">{renderTemplate(tpl.footer, vars)}</div>
                </div>
              </CardContent>
            </Card>
          </>}
        </div>
      )}
    </div>
  );
}
