import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/menus")({ component: Menus });

function Menus() {
  const { menus, currentCompanyId, addMenu, removeMenu, updateMenu, reorderMenu } = useStore();
  const list = menus.filter((m) => m.companyId === currentCompanyId).sort((a, b) => a.order - b.order);
  const [form, setForm] = useState({ label: "", href: "" });

  const move = (i: number, dir: -1 | 1) => {
    const ids = list.map((m) => m.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderMenu(ids);
  };

  return (
    <div>
      <PageHeader title="Menu Builder" description="Customer-facing navigation menus" />
      <Card className="mb-4">
        <CardContent className="flex gap-2 pt-4">
          <Input placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Input placeholder="/href" value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} />
          <Button onClick={() => {
            if (!currentCompanyId || !form.label) return toast.error("Label required");
            addMenu({ companyId: currentCompanyId, label: form.label, href: form.href || "/", icon: "Link", visible: true, order: list.length });
            setForm({ label: "", href: "" });
          }}><Plus className="h-4 w-4" /></Button>
        </CardContent>
      </Card>
      {list.length === 0 ? <EmptyState title="No menus yet" /> : (
        <div className="space-y-2">
          {list.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground"><ChevronUp className="h-3 w-3" /></button>
                <button onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground"><ChevronDown className="h-3 w-3" /></button>
              </div>
              <Input className="max-w-xs" value={m.label} onChange={(e) => updateMenu(m.id, { label: e.target.value })} />
              <Input className="max-w-xs" value={m.href} onChange={(e) => updateMenu(m.id, { href: e.target.value })} />
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground">Visible</span>
                <Switch checked={m.visible} onCheckedChange={(v) => updateMenu(m.id, { visible: v })} />
                <Button variant="ghost" size="icon" onClick={() => removeMenu(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
