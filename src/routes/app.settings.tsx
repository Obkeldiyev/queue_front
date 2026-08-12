import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { useAuthStore } from "@/lib/auth-store";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { companiesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({
  beforeLoad: requireCompanyAdmin,
  component: Settings,
});

function Settings() {
  const { user } = useAuthStore();
  const { currentCompanyId } = useStore();
  const { t } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => companiesApi.get(companyId).then((r) => r.data),
    enabled: !!companyId,
  });

  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", website: "",
    primary_color: "#2563eb", timezone: "Asia/Tashkent",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        address: company.address ?? "",
        website: company.website ?? "",
        primary_color: company.primary_color ?? "#2563eb",
        timezone: company.timezone ?? "Asia/Tashkent",
      });
    }
  }, [company]);

  const updateMutation = useMutation({
    mutationFn: () => companiesApi.update(companyId, form),
    onSuccess: () => {
      toast.success("Settings saved");
      void qc.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settings")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Company profile and preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Company information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1" placeholder="https://example.com" />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1" />
          </div>
          <div>
            <Label>Brand color</Label>
            <div className="mt-1 flex items-center gap-3">
              <input type="color" value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="h-9 w-14 cursor-pointer rounded border p-1" />
              <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="flex-1 font-mono" maxLength={7} />
            </div>
          </div>
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving…" : t("save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

