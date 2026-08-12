import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { useLang, loc } from "@/lib/i18n";
import { useAuthStore } from "@/lib/auth-store";
import { useQuery, useMutation } from "@tanstack/react-query";
import { devicesApi, companiesApi, branchesApi } from "@/lib/api";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { buildDeviceLink } from "@/lib/queue-helpers";
import {
  Eye, Link2, Save, RotateCcw, Copy, ExternalLink,
  Monitor, Tv2, ChevronUp, ChevronDown, Check,
} from "lucide-react";

export const Route = createFileRoute("/app/kioskEditor")({
  beforeLoad: requireCompanyAdmin,
  component: KioskEditor,
});

const ALL_COMPONENTS = [
  { key: "title",       label: "Page title",           desc: "Big heading at top" },
  { key: "branchName",  label: "Branch name",           desc: "Shows the branch above the title" },
  { key: "serviceList", label: "Service list",          desc: "The queue/service buttons" },
  { key: "language",    label: "Language switcher",     desc: "UZ / RU / EN toggle" },
  { key: "qr",          label: "QR code",               desc: "Scannable QR for mobile" },
  { key: "clock",       label: "Clock",                 desc: "Live time (display board)" },
  { key: "header",      label: "Header",                desc: "Top header row (display board)" },
];

const DEFAULT_COMPONENTS = ["title", "branchName", "serviceList", "language"];

const THEME_OPTIONS = [
  { value: "dark",  label: "Dark",        preview: "bg-slate-900 text-white" },
  { value: "light", label: "Light",       preview: "bg-white text-slate-900 border" },
  { value: "auto",  label: "Auto (system)", preview: "bg-gradient-to-r from-slate-900 to-white" },
] as const;

function KioskEditor() {
  const { lang } = useLang();
  const { user } = useAuthStore();
  const companyId = user?.type === "company_user" ? user.company_id : undefined;

  const [components, setComponents] = useState<string[]>(DEFAULT_COMPONENTS);
  const [kioskTheme, setKioskTheme] = useState<"dark" | "light" | "auto">("dark");
  const [displayTheme, setDisplayTheme] = useState<"dark" | "light">("dark");
  const [targetDevice, setTargetDevice] = useState<string>("all");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    try {
      const raw = localStorage.getItem(`kiosk_settings_${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          settings?: { theme?: string; displayTheme?: string; components?: string[] };
          theme?: string;
          displayTheme?: string;
          components?: string[];
        };
        const rootTheme = parsed.theme ?? parsed.settings?.theme;
        const rootDisplayTheme = parsed.displayTheme ?? parsed.settings?.displayTheme;
        const rootComponents = parsed.components ?? parsed.settings?.components;
        if (rootTheme) setKioskTheme(rootTheme as typeof kioskTheme);
        if (rootDisplayTheme) setDisplayTheme(rootDisplayTheme as typeof displayTheme);
        if (rootComponents?.length) setComponents(rootComponents);
      }
    } catch { /* ignore */ }
  }, [companyId]);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => branchesApi.list({ company_id: companyId! }).then((r) => r.data),
    enabled: !!companyId,
  });
  useEffect(() => {
    if (branches.length > 0 && !selectedBranchId) setSelectedBranchId(branches[0].id);
  }, [branches, selectedBranchId]);

  const { data: devices = [] } = useQuery({
    queryKey: ["devices", companyId],
    queryFn: () =>
      devicesApi.list(companyId ? { company_id: companyId } : undefined).then((r) => r.data),
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const payload = { theme: kioskTheme, displayTheme, components };
      localStorage.setItem(`kiosk_settings_${companyId}`, JSON.stringify(payload));
      await companiesApi.update(companyId, { settings: payload });
      if (targetDevice === "all") {
        await Promise.all(devices.map((d) => devicesApi.update(d.id, { settings: payload })));
      } else if (targetDevice !== "all") {
        await devicesApi.update(targetDevice, { settings: payload });
      }
    },
    onSuccess: () => {
      toast.success("Settings saved to all devices");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const toggleComponent = (key: string) =>
    setComponents((c) => c.includes(key) ? c.filter((x) => x !== key) : [...c, key]);

  const moveComponent = (idx: number, dir: -1 | 1) => {
    const arr = [...components];
    const to = idx + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[idx], arr[to]] = [arr[to], arr[idx]];
    setComponents(arr);
  };

  const getUrl = (mode: "kiosk" | "display") =>
    targetDevice !== "all"
      ? buildDeviceLink(mode, selectedBranchId, targetDevice)
      : buildDeviceLink(mode, selectedBranchId);

  const copyUrl = (mode: "kiosk" | "display") => {
    if (!selectedBranchId) return toast.error("Select a branch first");
    void navigator.clipboard.writeText(getUrl(mode));
    toast.success(`${mode === "kiosk" ? "Kiosk" : "Display"} URL copied`);
  };

  const openPreview = (mode: "kiosk" | "display") => {
    if (!selectedBranchId) return toast.error("Select a branch first");
    window.open(getUrl(mode), "_blank");
  };

  const openPair = () => {
    if (!selectedBranchId) return toast.error("Select a branch first");
    if (targetDevice === "all") return toast.error("Select a specific device to pair");
    const enc = window.btoa(
      unescape(encodeURIComponent(JSON.stringify({ theme: kioskTheme, displayTheme, components })))
    );
    window.open(`/pair?device=${targetDevice}&data=${enc}&dest=kiosk&branch=${selectedBranchId}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kiosk &amp; Display Editor</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure what appears on your kiosk screens and waiting display boards.
          </p>
        </div>
        <Button
          className="gap-2 min-w-[140px]"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? (
            <><Check className="h-4 w-4" /> Saved</>
          ) : (
            <><Save className="h-4 w-4" />{saveMutation.isPending ? "Saving…" : "Save settings"}</>
          )}
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Kiosk theme picker */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary shrink-0" />
              <h3 className="text-sm font-semibold">Kiosk theme</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setKioskTheme(opt.value)}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-medium transition ${
                    kioskTheme === opt.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className={`h-5 w-full rounded ${opt.preview}`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display/Billboard theme picker */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Tv2 className="h-4 w-4 text-indigo-500 shrink-0" />
              <h3 className="text-sm font-semibold">Display board theme</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.filter((o) => o.value !== "auto").map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDisplayTheme(opt.value as "dark" | "light")}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2.5 text-xs font-medium transition ${
                    displayTheme === opt.value
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className={`h-5 w-full rounded ${opt.preview}`} />
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Applies to the waiting queue display board (/display)
            </p>
          </div>

          {/* Branch + Device targeting */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Target</h3>
            <div>
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue placeholder="Select branch…" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {loc(b as unknown as Record<string, unknown>, "name", lang) || b.name_uz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Apply to device</Label>
              <Select value={targetDevice} onValueChange={setTargetDevice}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All devices</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}{d.serial_number ? ` · ${d.serial_number}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick open / link section */}
          {selectedBranchId && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Open &amp; share</h3>

              {/* Kiosk */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Monitor className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs font-medium">Kiosk screen</span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 gap-1.5 text-xs h-8"
                    onClick={() => openPreview("kiosk")}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyUrl("kiosk")}
                    title="Copy kiosk URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open(getUrl("kiosk"), "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Display */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Tv2 className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <span className="text-xs font-medium">Waiting display board</span>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 gap-1.5 text-xs h-8"
                    onClick={() => openPreview("display")}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => copyUrl("display")}
                    title="Copy display URL"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => window.open(getUrl("display"), "_blank")}
                    title="Open in new tab"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Pair */}
              <Button
                variant="secondary" size="sm"
                className="w-full gap-1.5 text-xs h-8"
                onClick={openPair}
              >
                <Link2 className="h-3.5 w-3.5" />
                Pair selected device
              </Button>
            </div>
          )}

          {/* Reset */}
          <button
            onClick={() => { setComponents(DEFAULT_COMPONENTS); setKioskTheme("dark"); setDisplayTheme("dark"); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-muted-foreground hover:text-foreground hover:border-border transition"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        </div>

        {/* ── RIGHT PANEL: component list ───────────────────────────── */}
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h2 className="font-semibold">Visible components</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Toggle which sections show on screen and drag to reorder.
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {components.length} / {ALL_COMPONENTS.length} on
            </Badge>
          </div>

          <div className="space-y-2">
            {ALL_COMPONENTS.map(({ key, label, desc }) => {
              const idx = components.indexOf(key);
              const active = idx !== -1;
              return (
                <div
                  key={key}
                  className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    active
                      ? "border-primary/20 bg-primary/3 shadow-sm"
                      : "border-border bg-muted/20 opacity-55"
                  }`}
                >
                  {/* Toggle switch */}
                  <button
                    role="switch"
                    aria-checked={active}
                    onClick={() => toggleComponent(key)}
                    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${
                      active ? "bg-primary" : "bg-muted-foreground/25"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        active ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>

                  {/* Label + description */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-none ${active ? "" : "text-muted-foreground"}`}>
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                  </div>

                  {/* Order badge + move buttons — only when active */}
                  {active ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 tabular-nums">
                        #{idx + 1}
                      </Badge>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveComponent(idx, -1)}
                          disabled={idx === 0}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-25 transition"
                          aria-label="Move up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveComponent(idx, 1)}
                          disabled={idx === components.length - 1}
                          className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted disabled:opacity-25 transition"
                          aria-label="Move down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 shrink-0" /> /* spacer to keep alignment */
                  )}
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <p className="mt-4 text-xs text-muted-foreground">
            Order only affects kiosk. Display board always uses its own layout.
          </p>
        </div>
      </div>
    </div>
  );
}

