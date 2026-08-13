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

declare global {
  interface Window {
    qubitKiosk?: {
      printReceipt: (html: string) => Promise<unknown>;
      getPrinters: () => Promise<unknown[]>;
    };
  }
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
      // Show every USB device Chrome is willing to expose to WebUSB.
      // Chrome may still hide protected classes and OS-only printer devices.
      filters: [{}],
    });
    return true;
  } catch {
    return false;
  }
}

export async function pairBrowserPrinter(): Promise<boolean> {
  return pairUsbPrinter();
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML receipt builder (for iframe fallback)
// ─────────────────────────────────────────────────────────────────────────────
function buildReceiptHtml(opts: PrintTicketOptions): string {
  const { ticketNumber, queueName: qName, counterName: cName, position, estimatedWaitMins, branchName, lang = "en" } = opts;

  const L = {
    uz: { title: "NAVBAT CHIPTASI", service: "Xizmat", window: "Kabinet", pos: "Navbat raqami", wait: "Kutish vaqti", min: "daq", printed: "Chop etildi", thanks: "Xizmatdan foydalanganingiz uchun rahmat!", wifi: "Qubit QMS" },
    ru: { title: "ТАЛОН ОЧЕРЕДИ",   service: "Услуга",  window: "Кабинет", pos: "Номер в очереди", wait: "Время ожидания", min: "мин", printed: "Напечатано", thanks: "Спасибо за обращение!", wifi: "Qubit QMS" },
    en: { title: "QUEUE TICKET",    service: "Service", window: "Window",  pos: "Queue position", wait: "Est. wait", min: "min", printed: "Printed", thanks: "Thank you for your visit!", wifi: "Qubit QMS" },
  }[lang] ?? { title: "QUEUE TICKET", service: "Service", window: "Window", pos: "Queue position", wait: "Est. wait", min: "min", printed: "Printed", thanks: "Thank you for your visit!", wifi: "Qubit QMS" };

  const now = new Date();
  const dateStr = now.toLocaleDateString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString(lang === "uz" ? "uz-UZ" : lang === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });

return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{
  width:80mm;
  font-family:'Courier New',Courier,monospace;
  background:#fff;
  color:#000;
  font-size:13px;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
body{padding:4mm 5mm 6mm}
.center{text-align:center}
.bold{font-weight:900}
.upper{text-transform:uppercase}
.org{
  font-size:15px;
  font-weight:900;
  letter-spacing:1px;
  text-transform:uppercase;
  text-align:center;
  margin-bottom:1mm;
  word-break:break-word;
}
.subtitle{
  font-size:10px;
  text-align:center;
  color:#444;
  margin-bottom:3mm;
  letter-spacing:0.5px;
}
.hr-solid{border:none;border-top:1.5px solid #000;margin:3mm 0}
.hr-dash{border:none;border-top:1px dashed #777;margin:3mm 0}
.ticket-label{
  font-size:10px;
  text-align:center;
  letter-spacing:2px;
  text-transform:uppercase;
  color:#333;
  margin-bottom:1mm;
}
.ticket-num{
  font-size:72px;
  font-weight:900;
  text-align:center;
  letter-spacing:4px;
  line-height:1;
  margin:2mm 0 3mm;
}
.service-box{
  border:1.5px solid #000;
  padding:2mm 3mm;
  margin:3mm 0;
  text-align:center;
}
.service-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:1mm}
.service-val{font-size:14px;font-weight:900;word-break:break-word}
.info-row{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  font-size:11px;
  padding:1.5mm 0;
  border-bottom:1px dotted #ccc;
}
.info-row:last-of-type{border-bottom:none}
.info-lbl{color:#444}
.info-val{font-weight:900;text-align:right;max-width:45mm;word-break:break-word}
.thanks{
  text-align:center;
  font-size:11px;
  font-weight:bold;
  padding:3mm 0 1mm;
  letter-spacing:0.3px;
}
.wifi{
  text-align:center;
  font-size:9px;
  color:#666;
  margin-top:1mm;
}
.datetime{
  text-align:center;
  font-size:9px;
  color:#666;
  margin-top:2mm;
}
@page{size:80mm auto;margin:0}
@media print{
  html,body{width:80mm}
  .ticket-num{font-size:72px}
}
</style></head><body>

${branchName ? `<div class="org">${branchName}</div>` : `<div class="org">Qubit QMS</div>`}
<div class="subtitle">${L.title}</div>

<hr class="hr-solid"/>

<div class="ticket-label">${L.pos}</div>
<div class="ticket-num">${ticketNumber}</div>

<hr class="hr-dash"/>

<div class="service-box">
  <div class="service-lbl">${L.service}</div>
  <div class="service-val">${qName}</div>
</div>

${cName ? `
<div class="service-box">
  <div class="service-lbl">${L.window}</div>
  <div class="service-val">${cName}</div>
</div>` : ""}

${(position != null || estimatedWaitMins != null) ? `
<hr class="hr-dash"/>
<div>
  ${position != null ? `<div class="info-row"><span class="info-lbl">${L.pos}</span><span class="info-val">${position}</span></div>` : ""}
  ${estimatedWaitMins != null ? `<div class="info-row"><span class="info-lbl">${L.wait}</span><span class="info-val">~${estimatedWaitMins} ${L.min}</span></div>` : ""}
</div>` : ""}

<hr class="hr-solid"/>

<div class="thanks">${L.thanks}</div>
<div class="wifi">${L.wifi}</div>
<div class="datetime">${dateStr}  ${timeStr}</div>

</body></html>`;
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

  (async () => {
    if (window.qubitKiosk?.printReceipt) {
      try {
        await window.qubitKiosk.printReceipt(buildReceiptHtml(opts));
        return;
      } catch (error) {
        console.error("[kiosk print] Electron silent print failed.", error);
        if (opts.silentOnly) return;
      }
    }

    if (shouldUseLocalBridge(opts)) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 500);
        const pairingToken = typeof window !== "undefined" ? localStorage.getItem("qms_pairing_token") : null;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (pairingToken) headers.Authorization = `Bearer ${pairingToken}`;
        const resp = await fetch("http://localhost:4020/print", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: buildReceiptText(opts), html: buildReceiptHtml(opts) }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (resp.ok) return;
      } catch {
        // ignore and continue to other fallbacks
      }
    }

    const usedUsb = await printViaUsb(opts).catch(() => false);
    if (usedUsb) return;

    const allowSerialFallback =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("serialPrinter") === "1";
    if (allowSerialFallback) {
      const used = await printViaSerial(opts).catch(() => false);
      if (used) return;
    }

    if (opts.silentOnly) {
      console.warn("[kiosk print] No direct printer permission is available.");
      return;
    }

    printViaIframe(opts);
  })();
}
