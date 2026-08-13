import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/pair")({
  head: () => ({ meta: [{ title: "Pair Device — Qubit QMS" }] }),
  component: PairPage,
});

function decodeB64(s: string) {
  try {
    return JSON.parse(decodeURIComponent(escape(window.atob(s))));
  } catch {
    try { return JSON.parse(window.atob(s)); } catch { return null; }
  }
}

function PairPage() {
  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const device = params.get("device");
      const data = params.get("data");

      if (!device) {
        toast.error("No device specified");
        return;
      }

        const dest = params.get("dest") || "kiosk";
        const branch = params.get("branch");
        const redirectUrl = `/${dest}?device=${device}${branch ? `&branch=${branch}` : ""}`;

        if (data) {
          const parsed = decodeB64(data);
          if (parsed) {
            try {
              localStorage.setItem(`paired_device_${device}`, JSON.stringify({ device, settings: parsed }));
              // If pairing token present in settings, persist short key for local bridge and post to local daemon
              const token = parsed.pairingToken || parsed.pairing_token || parsed.settings?.pairingToken || parsed.settings?.pairing_token;
              const printerName = parsed.printerName || parsed.printer || parsed.settings?.printerName || parsed.settings?.printer;
              if (token) {
                try { localStorage.setItem("qms_pairing_token", token); } catch { /* ignore */ }
                // Try to notify local print bridge (best-effort)
                try {
                  fetch("http://localhost:4020/config", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ pairingToken: token, printerName }),
                    keepalive: true,
                  }).catch(() => {});
                } catch { /* ignore */ }
              }
              try {
                const { devicesApi } = await import("@/lib/api");
                await devicesApi.update(device, { settings: parsed });
              } catch {
                // ignore device API update failures
              }
              toast.success("Device paired locally — opening device view...");
              window.location.href = redirectUrl;
              return;
            } catch (e) { /* ignore */ }
          }
        }

        // If no data provided, just mark device as paired with empty settings
        try {
          localStorage.setItem(`paired_device_${device}`, JSON.stringify({ device, settings: {} }));
          toast.success("Device paired (no settings) — opening device view...");
          window.location.href = redirectUrl;
        } catch (e) {
          toast.error("Failed to pair device");
        }
    })();
  }, []);

  return <div className="p-6">Pairing device...</div>;
}

