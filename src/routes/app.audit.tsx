import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader, EmptyState } from "@/components/qms/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/app/audit")({ component: Audit });

function Audit() {
  const { audit } = useStore();
  return (
    <div>
      <PageHeader title="Audit Log" description="Every action across the platform" />
      {audit.length === 0 ? <EmptyState title="No activity yet" /> : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Target</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</TableCell>
                  <TableCell>{a.user}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell className="text-muted-foreground">{a.target}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.ip}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
