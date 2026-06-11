import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    waiting: "bg-warning/15 text-warning border-warning/30",
    called: "bg-primary/15 text-primary border-primary/30",
    serving: "bg-accent/15 text-accent border-accent/30",
    completed: "bg-success/15 text-success border-success/30",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
    "no-show": "bg-muted text-muted-foreground border-border",
    online: "bg-success/15 text-success border-success/30",
    offline: "bg-destructive/15 text-destructive border-destructive/30",
    pending: "bg-warning/15 text-warning border-warning/30",
    accepted: "bg-primary/15 text-primary border-primary/30",
    preparing: "bg-accent/15 text-accent border-accent/30",
    ready: "bg-success/15 text-success border-success/30",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/30 p-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
