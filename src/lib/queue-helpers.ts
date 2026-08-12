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
  useLocalBridge?: boolean;
  silentOnly?: boolean;
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
let _usbDevice: unknown = null;

/**
 * Try to print via Web Serial API (direct thermal printer, NO dialog).
 * Does not fall back to window.print(); that opens Chrome/Edge print UI.
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

export async function hasDirectPrinterAccess(): Promise<boolean> {
  try {
    const serialPorts = "serial" in navigator
      ? await (navigator as any).serial.getPorts() as unknown[]
      : [];
    if (serialPorts.length > 0) return true;

    const usbDevices = (navigator as any).usb
      ? await (navigator as any).usb.getDevices() as unknown[]
      : [];
    return usbDevices.length > 0;
  } catch {
    return false;
  }
}

async function findUsbOutEndpoint(device: any): Promise<{ interfaceNumber: number; endpointNumber: number } | null> {
  const configuration = device.configuration ?? device.configurations?.[0];
  if (!configuration) return null;

  for (const iface of configuration.interfaces ?? []) {
    for (const alternate of iface.alternates ?? []) {
      const endpoint = alternate.endpoints?.find((e: any) => e.direction === "out" && e.type === "bulk")
        ?? alternate.endpoints?.find((e: any) => e.direction === "out");
      if (!endpoint) continue;
      if (device.configuration?.configurationValue !== configuration.configurationValue) {
        await device.selectConfiguration(configuration.configurationValue);
      }
      await device.claimInterface(iface.interfaceNumber);
      if (alternate.alternateSetting) {
        await device.selectAlternateInterface(iface.interfaceNumber, alternate.alternateSetting);
      }
      return { interfaceNumber: iface.interfaceNumber, endpointNumber: endpoint.endpointNumber };
    }
  }

  return null;
}

async function printViaUsb(opts: PrintTicketOptions): Promise<boolean> {
  try {
    const usb = (navigator as any).usb;
    if (!usb) return false;

    const devices = await usb.getDevices();
    let device = _usbDevice as any;
    if (!device && devices.length > 0) device = devices[0];
    if (!device) return false;

    _usbDevice = device;
    await device.open();
    const endpoint = await findUsbOutEndpoint(device);
    if (!endpoint) {
      try { await device.close(); } catch { /* ignore */ }
      return false;
    }

    const bytes = buildEscPosReceipt(opts);
    await device.transferOut(endpoint.endpointNumber, bytes);
    try { await device.releaseInterface(endpoint.interfaceNumber); } catch { /* ignore */ }
    try { await device.close(); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

export async function pairUsbPrinter(): Promise<boolean> {
  try {
    const usb = (navigator as any).usb;
    if (!usb) return false;
    _usbDevice = await usb.requestDevice({
      filters: [
        { classCode: 0x07 }, // USB printer class
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x1a86 }, // CH340/CH341 USB serial adapters
        { vendorId: 0x067b }, // Prolific USB serial adapters
        { vendorId: 0x0483 }, // STMicro controllers used by some receipt printers
        { vendorId: 0x1504 }, // common POS/receipt printer vendor id
        { vendorId: 0x0fe6 }, // common POS/receipt printer vendor id
      ],
    });
    return true;
  } catch {
    return false;
  }
}

export async function pairBrowserPrinter(): Promise<boolean> {
  const usbOk = await pairUsbPrinter();
  if (usbOk) return true;
  return pairThermalPrinter();
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
html,body{width:80mm;min-height:1px;font-family:'Courier New',monospace;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:3mm 4mm 5mm}
.wrap{width:72mm;border:1.5px dashed #444;padding:3mm;border-radius:2px}
.org{text-align:center;font-size:12px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px;word-break:break-word}
.ttl{text-align:center;font-size:9px;color:#555;margin-bottom:5px}
.hr{border-top:1px dashed #aaa;margin:5px 0}
.num{text-align:center;font-size:60px;font-weight:900;letter-spacing:3px;line-height:1;margin:7px 0}
.winbox{border:2px solid #000;padding:5px 8px;text-align:center;margin:6px 0;font-size:13px;font-weight:bold;border-radius:2px}
.wlbl{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#555}
.row{display:flex;justify-content:space-between;font-size:10px;padding:2px 0}
.lbl{color:#555}.val{font-weight:bold;text-align:right;max-width:42mm;word-break:break-word}
.footer{font-size:8px;color:#999;text-align:center;margin-top:8px}
@page{size:80mm auto;margin:0}
@media print{html,body{width:80mm}.wrap{box-shadow:none}}
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

function centerLine(value: string, width = 32): string {
  const text = value.trim();
  if (text.length >= width) return text;
  const left = Math.floor((width - text.length) / 2);
  return `${" ".repeat(left)}${text}`;
}

function buildReceiptText(opts: PrintTicketOptions): string {
  const { ticketNumber, queueName: qName, counterName: cName, position, estimatedWaitMins, branchName, lang = "en" } = opts;
  const L = {
    uz: { title: "Navbat chiptasi", service: "Xizmat", window: "Kabinet", pos: "O'rningiz", wait: "Kutish", min: "daq", printed: "Chop etildi" },
    ru: { title: "Талон очереди", service: "Услуга", window: "Кабинет", pos: "Место", wait: "Ожидание", min: "мин", printed: "Напечатано" },
    en: { title: "Queue Ticket", service: "Service", window: "Window", pos: "Position", wait: "Wait", min: "min", printed: "Printed" },
  }[lang] ?? { title: "Queue Ticket", service: "Service", window: "Window", pos: "Position", wait: "Wait", min: "min", printed: "Printed" };

  const lines = [
    branchName ? centerLine(branchName.toUpperCase()) : "",
    centerLine(L.title),
    "--------------------------------",
    centerLine(ticketNumber, 32),
    "--------------------------------",
    `${L.service}: ${qName}`,
  ];

  if (cName) lines.push(`${L.window}: ${cName}`);
  if (position != null) lines.push(`${L.pos}: ${position}`);
  if (estimatedWaitMins != null) lines.push(`${L.wait}: ~${estimatedWaitMins} ${L.min}`);
  lines.push("--------------------------------");
  lines.push(`${L.printed}: ${new Date().toLocaleTimeString()}`);

  return lines.filter(Boolean).join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser print fallback. This is the only path Chrome/Edge expose for normal
// installed printers such as "w80", and it opens the browser print UI.
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

function shouldUseLocalBridge(opts: PrintTicketOptions): boolean {
  if (opts.useLocalBridge) return true;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("printBridge") === "1" || localStorage.getItem("qms_use_print_bridge") === "1";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — direct printer APIs first, browser print fallback last.
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

  // A browser page cannot select printer "w80" from JavaScript. Try every
  // browser-accessible direct path first, then use browser printing.
  (async () => {
    if (shouldUseLocalBridge(opts)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 500);
        const resp = await fetch("http://localhost:4020/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: buildReceiptText(opts), html: buildReceiptHtml(opts) }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) return;
      } catch {
        // ignore and continue to other fallbacks
      }
    }

    const used = await printViaSerial(opts).catch(() => false);
    if (used) return;

    const usedUsb = await printViaUsb(opts).catch(() => false);
    if (usedUsb) return;

    if (opts.silentOnly) {
      console.warn("[kiosk print] No direct printer permission is available.");
      return;
    }

    printViaIframe(opts);
  })();
}
