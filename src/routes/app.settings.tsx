import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/qms/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { seed, reset } = useStore();
  const [push, setPush] = useState(true);
  const [sms, setSms] = useState(false);
  const [telegram, setTelegram] = useState(true);
  const [email, setEmail] = useState(true);

  return (
    <div>
      <PageHeader title="Settings" description="Platform-wide preferences" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Notification channels</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Push notifications", v: push, set: setPush },
              { label: "SMS", v: sms, set: setSms },
              { label: "Telegram", v: telegram, set: setTelegram },
              { label: "Email", v: email, set: setEmail },
            ].map((c) => (
              <div key={c.label} className="flex items-center justify-between rounded-lg border p-3">
                <Label>{c.label}</Label>
                <Switch checked={c.v} onCheckedChange={c.set} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            {["Click", "Payme", "Uzum Bank", "Stripe", "PayPal", "Telegram Bot", "CRM", "ERP"].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>{i}</span><span className="text-xs text-muted-foreground">Not connected</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Demo data</CardTitle></CardHeader>
          <CardContent className="space-x-2">
            <Button onClick={() => { reset(); seed(); toast.success("Demo data restored"); }}>Reset & re-seed</Button>
            <Button variant="destructive" onClick={() => { reset(); toast.success("All data wiped"); }}>Wipe all data</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
