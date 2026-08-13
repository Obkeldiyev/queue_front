import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth-store";
import { useStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { devicesApi, branchesApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus, Trash2, Cpu, Wifi, WifiOff, Copy, ExternalLink, QrCode, KeyRound, Download } from "lucide-react";
import { toast } from "sonner";
import { buildDeviceLink } from "@/lib/queue-helpers";

export const Route = createFileRoute("/app/devices")({ beforeLoad: requireCompanyAdmin, component: Devices });

const DEVICE_TYPES = ["TICKET_KIOSK","QUEUE_DISPLAY","COUNTER_DISPLAY","TICKET_PRINTER","OPERATOR_KEYBOARD","QR_SCANNER","MEDIA_DISPLAY"] as const;

const STATUS_ICON: Record<string, React.ReactElement> = {
  ONLINE: <Wifi className="h-4 w-4 text-green-500" />,
  OFFLINE: <WifiOff className="h-4 w-4 text-red-400" />,
  MAINTENANCE: <WifiOff className="h-4 w-4 text-amber-400" />,
  UNREGISTERED: <WifiOff className="h-4 w-4 text-slate-400" />,
};

const STATUS_COLOR: Record<string, string> = {
  ONLINE: "border-green-300 text-green-700", OFFLINE: "border-red-300 text-red-700",
  MAINTENANCE: "border-amber-300 text-amber-700", UNREGISTERED: "border-slate-300 text-slate-400",
};

function deviceMode(type: string): "kiosk" | "display" | "operator" | "pair" {
  if (type === "TICKET_PRINTER") return "pair";
  if (type.includes("KIOSK")) return "kiosk";
  if (type.includes("DISPLAY")) return "display";
  return "operator";
}

function deviceLaunchLinks(type: string, branchId: string, deviceId: string) {
  const mode = deviceMode(type);
  if (mode === "pair") {
    return [{ label: "Printer setup", url: buildDeviceLink("kiosk", branchId, deviceId) + "&setup=printer" }];
  }
  return [{ label: mode[0].toUpperCase() + mode.slice(1), url: buildDeviceLink(mode, branchId, deviceId) }];
}

function isKioskDevice(type: string) {
  return type.includes("KIOSK");
}

async function downloadKioskConfig(url: string, deviceId: string) {
  try {
    const body = { deviceId, kioskUrl: url, apiUrl: window.location.origin, printerName: "w80", fullscreen: true };
    const resp = await fetch(`/api/v1/kiosk/build`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const j = await resp.json().catch(() => ({}));
      toast.error(j.message || "Failed to build kiosk");
      return;
    }
    if (!contentType.includes("zip") && !contentType.includes("application/octet-stream") && !contentType.includes("application/zip")) {
      const text = await resp.text();
      try { const j = JSON.parse(text); toast.error(j.message || "Failed to build kiosk"); return; } catch { /* fallthrough */ }
    }
    const blob = await resp.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `qubit-kiosk-${deviceId.slice(0, 8)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast.success("Kiosk ZIP downloaded");
  } catch (e) {
    // fallback: open a direct GET URL so the browser performs the download natively
    try {
      const params = new URLSearchParams({ deviceId, kioskUrl: url, apiUrl: window.location.origin, printerName: "w80", fullscreen: String(true) });
      const downloadUrl = `/api/v1/kiosk/build?${params.toString()}`;
      window.open(downloadUrl, "_blank");
      toast.success("Download started (browser fallback)");
    } catch (err) {
      toast.error((e as Error).message || "Failed to download kiosk");
    }
  }
}

async function promptUploadAndZip(url: string, deviceId: string) {
  try {
    // load JSZip dynamically — bypass Vite SSR static analysis and TS module check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jszipMod = "jszip";
    const { default: JSZip } = await import(/* @vite-ignore */ jszipMod) as any;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".exe";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    const promise = new Promise<File | null>((resolve) => {
      fileInput.onchange = () => {
        const f = fileInput.files && fileInput.files[0];
        resolve(f ?? null);
      };
    });
    fileInput.click();
    const exeFile = await promise;
    fileInput.remove();
    if (!exeFile) {
      toast.error("No EXE selected");
      return;
    }

    const config = { kioskUrl: url, printerName: "w80", fullscreen: true, deviceId };
    const zip = new JSZip();
    const exeData = await exeFile.arrayBuffer();
    zip.file(exeFile.name, exeData);
    zip.file("kiosk-config.json", JSON.stringify(config, null, 2));
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `qubit-kiosk-${deviceId.slice(0, 8)}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    toast.success("Kiosk ZIP created locally");
  } catch (err) {
    toast.error((err as Error).message || "Failed to create local ZIP");
  }
}

function downloadKioskConfigLocal(url: string, deviceId: string) {
  const config = { kioskUrl: url, printerName: "w80", fullscreen: true };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `kiosk-config-${deviceId.slice(0, 8)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  toast.success("Kiosk config downloaded (local)");
}

function Devices() {
  const { user } = useAuthStore();
  const { currentCompanyId, currentBranchId } = useStore();
  const { lang } = useLang();
  const qc = useQueryClient();
  const companyId = user?.company_id ?? currentCompanyId ?? "";

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", companyId, currentBranchId],
    queryFn: () => devicesApi.list({ ...(companyId && { company_id: companyId }), ...(currentBranchId && { branch_id: currentBranchId }) }).then((r) => r.data),
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId }).then((r) => r.data),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", device_type: "TICKET_KIOSK" as typeof DEVICE_TYPES[number], serial_number: "" });
  const [created, setCreated] = useState<{ id: string; branch_id: string; device_type: string; auth_token?: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: () => devicesApi.create({ name: form.name, device_type: form.device_type, branch_id: currentBranchId!, company_id: companyId, serial_number: form.serial_number || undefined }),
    onSuccess: (res) => {
      setCreated(res.data);
      toast.success("Device registered");
      void qc.invalidateQueries({ queryKey: ["devices"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => devicesApi.delete(id),
    onSuccess: () => { toast.success("Device removed"); void qc.invalidateQueries({ queryKey: ["devices"] }); },
  });

  const copyLink = (url: string) => { void navigator.clipboard.writeText(url); toast.success("Copied!"); };

  const resetDialog = () => { setCreated(null); setForm({ name: "", device_type: "TICKET_KIOSK", serial_number: "" }); };

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Connect devices by opening their URL — no IP address needed.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetDialog(); }}>
          <DialogTrigger asChild><Button><Plus className="mr-1.5 h-4 w-4" />Register device</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{created ? "Device registered — copy its URL" : "Register new device"}</DialogTitle></DialogHeader>
            {created ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Open this URL on the device browser to connect it.</p>
                {deviceLaunchLinks(created.device_type, created.branch_id, created.id).map(({ label, url }) => {
                  return (
                    <div key={label} className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <div className="flex items-center gap-1">
                        <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs border">{url}</code>
                        <button onClick={() => copyLink(url)} className="rounded p-1 hover:bg-muted"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        <button onClick={() => window.open(url, "_blank")} className="rounded p-1 hover:bg-muted"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></button>
                      </div>
                    </div>
                  );
                })}
                {isKioskDevice(created.device_type) && (
                  <div className="rounded-lg border bg-muted/40 p-2.5">
                    <p className="mb-2 text-xs text-muted-foreground">For the Windows kiosk EXE, place this file next to the EXE and rename it to <code>kiosk-config.json</code>.</p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => {
                          const url = buildDeviceLink("kiosk", created.branch_id, created.id);
                          downloadKioskConfig(url, created.id);
                        }}
                      >
                        <Download className="h-3.5 w-3.5" /> Download EXE config
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => {
                          const url = buildDeviceLink("kiosk", created.branch_id, created.id);
                          downloadKioskConfigLocal(url, created.id);
                        }}
                      >
                        JSON
                      </Button>
                    </div>
                  </div>
                )}
                {created.auth_token && (
                  <div className="rounded-lg border bg-muted/40 p-2.5">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <KeyRound className="h-3.5 w-3.5" /> Device token
                    </div>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs border">{created.auth_token}</code>
                      <button onClick={() => copyLink(created.auth_token!)} className="rounded p-1 hover:bg-muted"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={() => { setOpen(false); resetDialog(); }}>Done</Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lobby Kiosk" className="mt-1" /></div>
                  <div><Label>Type *</Label>
                    <Select value={form.device_type} onValueChange={(v) => setForm({ ...form, device_type: v as typeof form.device_type })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{DEVICE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Serial number <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="SN-12345" className="mt-1" /></div>
                  {!currentBranchId && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">Select a branch from the header to register a device.</p>}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => createMutation.mutate()} disabled={!form.name || !currentBranchId || createMutation.isPending}>{createMutation.isPending ? "Registering…" : "Register"}</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          <Cpu className="mx-auto mb-3 h-8 w-8 opacity-30" />
          <p className="font-medium">No devices registered yet</p>
          <p className="mt-1 text-sm">Register a device and connect it by opening its URL on any browser.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => {
            const branchName = branches.find((b) => b.id === d.branch_id)?.name_uz ?? d.branch_id?.slice(0, 8);
            const launchLinks = deviceLaunchLinks(d.device_type, d.branch_id, d.id);
            return (
              <Card key={d.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">{STATUS_ICON[d.status] ?? STATUS_ICON.OFFLINE}{d.name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm(`Remove "${d.name}"?`)) deleteMutation.mutate(d.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">{d.device_type.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline" className={`text-xs ${STATUS_COLOR[d.status] ?? ""}`}>{d.status}</Badge>
                  </div>
                  {branchName && <div className="text-xs text-muted-foreground">Branch: {branchName}</div>}
                  {d.last_heartbeat && <div className="text-xs text-muted-foreground">Last seen: {new Date(d.last_heartbeat).toLocaleString()}</div>}
                  <div className="rounded-lg border bg-muted/40 p-2.5 space-y-1.5">
                    {launchLinks.map(({ label, url }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => copyLink(url)} className="rounded p-1 hover:bg-muted"><Copy className="h-3.5 w-3.5 text-muted-foreground" /></button>
                          <button onClick={() => window.open(url, "_blank")} className="rounded p-1 hover:bg-muted"><ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => {
                    const pairUrl = `${window.location.origin}/pair?device=${d.id}&branch=${d.branch_id}&dest=${deviceMode(d.device_type)}`;
                    window.open(pairUrl, "_blank");
                  }}>
                    <QrCode className="h-3.5 w-3.5" />Open &amp; Pair
                  </Button>
                  {isKioskDevice(d.device_type) && launchLinks[0] && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => downloadKioskConfig(launchLinks[0].url, d.id)}
                      >
                        <Download className="h-3.5 w-3.5" />Download EXE config
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => downloadKioskConfigLocal(launchLinks[0].url, d.id)}>JSON</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

