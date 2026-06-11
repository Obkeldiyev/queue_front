import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, StatCard } from "@/components/qms/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Dashboard() {
  const { tickets, queues, branches, devices, employees, currentBranchId, orders } = useStore();
  const branchTickets = tickets.filter((t) => !currentBranchId || t.branchId === currentBranchId);
  const today = new Date().toDateString();
  const todays = branchTickets.filter((t) => new Date(t.createdAt).toDateString() === today);
  const waiting = todays.filter((t) => t.status === "waiting").length;
  const serving = todays.filter((t) => t.status === "called" || t.status === "serving").length;
  const completed = todays.filter((t) => t.status === "completed").length;
  const noshow = todays.filter((t) => t.status === "no-show").length;

  const hourly = Array.from({ length: 12 }, (_, i) => {
    const hr = 8 + i;
    return { hour: `${hr}:00`, count: todays.filter((t) => new Date(t.createdAt).getHours() === hr).length };
  });
  const byQueue = queues.map((q) => ({ name: q.name, count: todays.filter((t) => t.queueId === q.id).length }));

  return (
    <div>
      <PageHeader title="Dashboard" description="Live operations overview" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Waiting" value={waiting} hint="Tickets in queue" />
        <StatCard label="Serving" value={serving} hint="Currently at counters" />
        <StatCard label="Completed today" value={completed} />
        <StatCard label="No-shows" value={noshow} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Branches" value={branches.length} />
        <StatCard label="Queues" value={queues.length} />
        <StatCard label="Devices" value={devices.length} hint={`${devices.filter((d) => d.status === "online").length} online`} />
        <StatCard label="Employees" value={employees.length} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tickets by hour</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tickets per queue</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byQueue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="count" fill="var(--color-accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Orders today" value={orders.filter((o) => new Date(o.createdAt).toDateString() === today).length} />
        <StatCard label="Online tickets" value={todays.filter((t) => t.source === "online").length} />
        <StatCard label="Kiosk tickets" value={todays.filter((t) => t.source === "kiosk").length} />
      </div>
    </div>
  );
}
