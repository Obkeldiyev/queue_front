export function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function estimateWaitTime(position: number, serviceEstimatedTime?: number | null): string {
  if (!serviceEstimatedTime || serviceEstimatedTime <= 0) return "—";
  const minutes = Math.max(1, (position + 1) * serviceEstimatedTime);
  return `${minutes} min`;
}

export function estimateWaitMinutes(position: number, serviceEstimatedTime?: number | null): number | null {
  if (!serviceEstimatedTime || serviceEstimatedTime <= 0) return null;
  return Math.max(1, (position + 1) * serviceEstimatedTime);
}

export function buildDeviceLink(
  mode: "operator" | "display" | "kiosk",
  branchId: string,
  deviceId?: string
): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ branch: branchId });
  if (deviceId) params.set("device", deviceId);
  return `${base}/${mode}?${params.toString()}`;
}

export interface PrintTicketOptions {
  ticketNumber: string;
  queueName: string;
  counterName?: string;
  position?: number;
  estimatedWaitMins?: number | null;
  branchName?: string;
  lang?: "uz" | "ru" | "en";
}

// ─────────────────────────────────────────────────────────────────────────────
// ESC/POS commands for thermal receipt printers
// These are sent directly via Web Serial API (no print dialog at all).
// ─────────────────────────────────────────────────────────────────────────────
function buildEscPosReceipt(opts: PrintTicketOptions): Uint8Array {
  const { ticketNumber, queueName, counterName, position, estimatedWaitMins, branchName, lang = "en" } = opts;

  const ESC = 0x1B;
  const GS  = 0x1D;
  const LF  = 0x0A;

  const enc = new TextEncoder();
  const bytes: number[] = [];

  const push = (s: string) => { enc.encode(s).forEach(b => bytes.push(b)); };
  const cmd  = (...b: number[]) => b.forEach(b => bytes.push(b));

  // Initialize
  cmd(ESC, 0x40);
  // Center align
  cmd(ESC, 0x61, 0x01);
  // Double-height + double-width for ticket number
  cmd(GS, 0x21, 0x11);
  push(ticketNumber + "\n\n");
  // Normal size
  cmd(GS, 0x21, 0x00);

  if (branchName) { push(branchName + "\n"); }

  const windowLabel = lang === "uz" ? "Kabinet" : lang === "ru" ? "Кабинет" : "Window";
  const serviceLabel = lang === "uz" ? "Xizmat" : lang === "ru" ? "Услуга" : "Service";
  const posLabel = lang === "uz" ? "O'rin" : lang === "ru" ? "Место" : "Position";
  const waitLabel = lang === "uz" ? "Kutish" : lang === "ru" ? "Ожидание" : "Wait";
  const minLabel = lang === "uz" ? "daq" : lang === "ru" ? "мин" : "min";
  const printedLabel = lang === "uz" ? "Chop etildi" : lang === "ru" ? "Напечатано" : "Printed";

  push("--------------------------------\n");
  // Left align for details
  cmd(ESC, 0x61, 0x00);
  push(`${serviceLabel}: ${queueName}\n`);
  if (counterName) push(`${windowLabel}: ${counterName}\n`);
  if (position != null) push(`${posLabel}: ${position}\n`);
  if (estimatedWaitMins != null) push(`${waitLabel}: ~${estimatedWaitMins} ${minLabel}\n`);
  push("--------------------------------\n");
  // Center
  cmd(ESC, 0x61, 0x01);
  push(`${printedLabel}: ${new Date().toLocaleTimeString()}\n`);
  // Feed and cut
  push("\n\n\n");
  cmd(GS, 0x56, 0x42, 0x00); // full cut

  return new Uint8Array(bytes);
}

// Cache the serial port between prints so we don't ask for permission every time
let _serialPort: unknown = null;

/**
 * Try to print via Web Serial API (direct thermal printer, NO dialog).
 * Falls back to the iframe/window.print() method if Serial API is unavailable
 * or the user hasn't paired a printer yet.
 *
 * HOW TO PAIR: On the kiosk, call `pairThermalPrinter()` once (e.g. from a
 * hidden admin button). The browser will show a one-time port picker.
 * After that, all prints are silent.
 */
async function printViaSerial(opts: PrintTicketOptions): Promise<boolean> {
  try {
    if (!("serial" in navigator)) return false;

    const ports = await (navigator as any).serial.getPorts() as unknown[];
    let port: unknown = _serialPort;

    if (!port && ports.length > 0) port = ports[0];
    if (!port) return false;

    _serialPort = port;

    const p = port as any;
    if (p.readable === null || p.writable === null) {
      await p.open({ baudRate: 9600 });
    }

    const writer = p.writable.getWriter();
    await writer.write(buildEscPosReceipt(opts));
    writer.releaseLock();
    return true;
  } catch {
    return false;
  }
}

/**
 * Show the browser's one-time serial port picker so the operator can pair
 * a thermal printer. Call this once from a setup screen or admin button.
 * After pairing, printTicketReceipt() will use it silently.
 */
export async function pairThermalPrinter(): Promise<boolean> {
  try {
    if (!("serial" in navigator)) return false;
    const port = await (navigator as any).serial.requestPort();
    await (port as any).open({ baudRate: 9600 });
    _serialPort = port;
    try { await (port as any).close(); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML receipt builder (for iframe fallback)
// ─────────────────────────────────────────────────────────────────────────────
function buildReceiptHtml(opts: PrintTicketOptions): string {
  const { ticketNumber, queueName: qName, counterName: cName, position, estimatedWaitMins, branchName, lang = "en" } = opts;

  const L = {
    uz: { title: "Navbat chiptasi", service: "Xizmat", window: "Kabinet", pos: "O'rningiz", wait: "Kutish", min: "daq", printed: "Chop etildi" },
    ru: { title: "Талон очереди",   service: "Услуга",  window: "Кабинет", pos: "Место",    wait: "Ожид.",  min: "мин", printed: "Напечатано" },
    en: { title: "Queue Ticket",    service: "Service", window: "Window",  pos: "Position", wait: "Wait",   min: "min", printed: "Printed" },
  }[lang] ?? { title: "Queue Ticket", service: "Service", window: "Window", pos: "Position", wait: "Wait", min: "min", printed: "Printed" };

  const ts = new Date().toLocaleTimeString();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:80mm;font-family:'Courier New',monospace;background:#fff;color:#000}
body{padding:6px 10px 12px}
.wrap{border:1.5px dashed #444;padding:8px 10px 12px;border-radius:3px}
.org{text-align:center;font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px}
.ttl{text-align:center;font-size:9px;color:#666;margin-bottom:6px}
.hr{border-top:1px dashed #bbb;margin:6px 0}
.num{text-align:center;font-size:68px;font-weight:900;letter-spacing:4px;line-height:1;margin:8px 0}
.winbox{border:2px solid #000;padding:5px 8px;text-align:center;margin:6px 0;font-size:13px;font-weight:bold;border-radius:3px}
.wlbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#555}
.row{display:flex;justify-content:space-between;font-size:10px;padding:2px 0}
.lbl{color:#666}.val{font-weight:bold}
.footer{font-size:8px;color:#999;text-align:center;margin-top:8px}
@media print{html,body{width:80mm}@page{size:80mm auto;margin:0}}
</style></head><body>
<div class="wrap">
${branchName ? `<div class="org">${branchName}</div>` : ""}
<div class="ttl">${L.title}</div>
<div class="hr"></div>
<div class="num">${ticketNumber}</div>
<div class="row"><span class="lbl">${L.service}</span><span class="val">${qName}</span></div>
${cName ? `<div class="winbox"><div class="wlbl">${L.window}</div>${cName}</div>` : ""}
${(position != null || estimatedWaitMins != null) ? '<div class="hr"></div>' : ""}
${position != null ? `<div class="row"><span class="lbl">${L.pos}</span><span class="val">${position}</span></div>` : ""}
${estimatedWaitMins != null ? `<div class="row"><span class="lbl">${L.wait}</span><span class="val">~${estimatedWaitMins} ${L.min}</span></div>` : ""}
<div class="hr"></div>
<div class="footer">${L.printed}: ${ts}</div>
</div></body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// iframe fallback — works on all browsers, triggers OS print dialog.
// On dedicated kiosk hardware, launch Chrome with --kiosk-printing to suppress
// the dialog: chrome --kiosk --kiosk-printing http://yourapp/kiosk?branch=...
// ─────────────────────────────────────────────────────────────────────────────
function printViaIframe(opts: PrintTicketOptions): void {
  if (typeof window === "undefined") return;

  const html = buildReceiptHtml(opts);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";
  iframe.src = url;
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    URL.revokeObjectURL(url);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch { /* ignore */ }
    setTimeout(cleanup, 8000);
  };

  // Safety fallback
  setTimeout(() => {
    if (iframe.parentNode) {
      try { iframe.contentWindow?.print(); } catch { /* ignore */ }
      setTimeout(cleanup, 5000);
    }
  }, 1500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — try serial first (silent), fall back to iframe
// ─────────────────────────────────────────────────────────────────────────────
export function printTicketReceipt(opts: PrintTicketOptions): void;
export function printTicketReceipt(
  ticketNumber: string,
  queueName: string,
  counterName?: string,
  options?: Partial<Omit<PrintTicketOptions, "ticketNumber" | "queueName" | "counterName">>
): void;
export function printTicketReceipt(
  ticketNumberOrOpts: string | PrintTicketOptions,
  queueName?: string,
  counterName?: string,
  options?: Partial<Omit<PrintTicketOptions, "ticketNumber" | "queueName" | "counterName">>
): void {
  if (typeof window === "undefined") return;

  const opts: PrintTicketOptions = typeof ticketNumberOrOpts === "string"
    ? { ticketNumber: ticketNumberOrOpts, queueName: queueName ?? "", counterName, ...options }
    : ticketNumberOrOpts;

  // Try local kiosk print daemon first (no browser print UI), then serial, then iframe.
  (async () => {
    try {
      const resp = await fetch("http://localhost:4020/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: buildReceiptHtml(opts) }),
      });
      if (resp.ok) return;
    } catch {
      // ignore and continue to other fallbacks
    }

    const used = await printViaSerial(opts).catch(() => false);
    if (used) return;
    // Final fallback to iframe (browser print dialog)
    printViaIframe(opts);
  })();
}
