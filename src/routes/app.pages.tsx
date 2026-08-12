import { createFileRoute } from "@tanstack/react-router";
import { requireCompanyAdmin } from "@/lib/guards";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/app/pages")({
  beforeLoad: requireCompanyAdmin,
  component: Pages,
});

// Page Builder is a complex drag-and-drop feature.
// It connects to the /pages backend API for full CMS functionality.
// For now we show a placeholder that links to the real kiosk editor.
function Pages() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed text-center p-12 text-muted-foreground">
      <FileText className="mx-auto mb-4 h-10 w-10 opacity-25" />
      <h2 className="text-lg font-semibold text-foreground">Page Builder</h2>
      <p className="mt-2 max-w-sm text-sm">
        Build custom landing pages for your kiosk and online portal.
        This feature uses the full CMS backend (<code className="text-xs bg-muted rounded px-1">/api/v1/pages</code>).
      </p>
      <p className="mt-4 text-xs">
        For kiosk screen customisation, use the{" "}
        <a href="/app/kioskEditor" className="text-primary underline">Kiosk Editor</a>.
      </p>
    </div>
  );
}

