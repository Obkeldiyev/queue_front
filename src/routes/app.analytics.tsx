import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/qms/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/app/analytics")({ component: Analytics });

function Analytics() {
  const { tickets, services, employees, currentBranchId } = useStore();
  const branchTickets = tickets.filter((t) => !currentBranchId || t.branchId === currentBranchId);
  const completed = branchTickets.filter((t) => t.status === "completed" && t.calledAt && t.completedAt);
  const avgService = completed.length
    ? Math.round(completed.reduce((a, t) => a + (new Date(t.completedAt!).getTime() - new Date(t.calledAt!).getTime()) / 60000, 0) / completed.length)
    : 0;
  const noShowRate = branchTickets.length ? Math.round(branchTickets.filter((t) => t.status === "no-show").length / branchTickets.length * 100) : 0;

  const peakHours = Array.from({ length: 14 }, (_, i) => {
    const hr = 7 + i;
    return { hour: `${hr}h`, count: branchTickets.filter((t) => new Date(t.createdAt).getHours() === hr).length };
  });

  const sourceData = [
    { name: "Online", value: branchTickets.filter((t) => t.source === "online").length },
    { name: "Kiosk", value: branchTickets.filter((t) => t.source === "kiosk").length },
  ];

  const operatorStats = employees.filter((e) => e.role === "operator").map((e) => ({
    name: e.name.split(" ")[0],
    served: branchTickets.filter((t) => t.operatorId === e.id && t.status === "completed").length,
  }));

  const byService = services.map((s) => ({ name: s.name, count: branchTickets.filter((t) => t.serviceId === s.id).length }));

  const COLORS = ["var(--color-primary)", "var(--color-accent)"];

  return (
    <div>
      <PageHeader title="Analytics" description="Performance and customer flow insights" />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total tickets" value={branchTickets.length} />
        <StatCard label="Avg service time" value={`${avgService} min`} />
        <StatCard label="No-show rate" value={`${noShowRate}%`} />
        <StatCard label="Completed" value={completed.length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Peak hours</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Online vs Kiosk</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><PieChart>
              <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Legend />
            </PieChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Operator performance</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={operatorStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="served" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tickets per service</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={byService}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
