#!/usr/bin/env node
/*
  Local silent print bridge for kiosk machines.

  Run on the kiosk computer:
    node tools/kiosk-printer-daemon.js --printer "EPSON WF-5620 Series"

  Endpoints:
    GET  /health
    GET  /printers
    POST /config  { printerName?: string }
    POST /print   { text?: string, html?: string, printerName?: string }

  Browser pages cannot suppress the Chrome/Edge print dialog by themselves.
  This daemon keeps printing outside the browser so users never see that prompt.
*/
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const args = parseArgs(process.argv.slice(2));
const PORT = Number(args.port || 4020);
const CONFIG_DIR = path.join(os.homedir(), ".qubit-qms");
const CONFIG_FILE = path.join(CONFIG_DIR, "kiosk-printer.json");

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    parsed[key] = next && !next.startsWith("--") ? next : true;
    if (parsed[key] === next) i += 1;
  }
  return parsed;
}

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(next) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...loadConfig(), ...next }, null, 2));
}

if (args.printer) saveConfig({ printerName: String(args.printer) });

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function run(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`));
    });
    if (input != null) child.stdin.end(input, "utf8");
  });
}

async function listPrinters() {
  if (process.platform === "win32") {
    const ps = [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-Command",
      "Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json",
    ];
    const output = await new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", ps, { windowsHide: true });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr.trim() || `powershell exited with ${code}`));
      });
    });
    const parsed = output ? JSON.parse(output) : [];
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  const output = await new Promise((resolve, reject) => {
    const child = spawn("lpstat", ["-a"]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `lpstat exited with ${code}`));
    });
  });
  return String(output)
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function normalizeReceiptText(text) {
  return String(text || "")
    .replace(/\r?\n/g, os.EOL)
    .trimEnd() + os.EOL + os.EOL;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function printTextWindows(text, printerName) {
  const script = `
$printerName = [Console]::In.ReadLine()
$content = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($printerName)) {
  $printerName = (Get-CimInstance Win32_Printer | Where-Object { $_.Default -eq $true } | Select-Object -First 1 -ExpandProperty Name)
}
if ([string]::IsNullOrWhiteSpace($printerName)) { throw "No printer configured and no default printer found." }
$printDoc = New-Object System.Drawing.Printing.PrintDocument
$printDoc.PrinterSettings.PrinterName = $printerName
$font = New-Object System.Drawing.Font("Consolas", 10)
$lines = $content -split "\\r?\\n"
$index = 0
$printDoc.add_PrintPage({
  param($sender, $event)
  $y = 4
  while ($script:index -lt $script:lines.Length) {
    $event.Graphics.DrawString($script:lines[$script:index], $script:font, [System.Drawing.Brushes]::Black, 4, $y)
    $y += 15
    $script:index += 1
    if ($y -gt ($event.MarginBounds.Bottom - 20)) {
      $event.HasMorePages = $true
      return
    }
  }
  $event.HasMorePages = $false
})
$printDoc.Print()
`;
  await run("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], `${printerName || ""}\n${normalizeReceiptText(text)}`);
}

async function printTextUnix(text, printerName) {
  const args = ["-o", "raw"];
  if (printerName) args.push("-d", printerName);
  await run("lp", args, normalizeReceiptText(text));
}

function tmpFile(ext) {
  return path.join(os.tmpdir(), `qubit_qms_${crypto.randomBytes(6).toString("hex")}.${ext}`);
}

async function printHtmlFallback(html, printerName) {
  const file = tmpFile("html");
  fs.writeFileSync(file, html, "utf8");
  try {
    if (process.platform === "win32") {
      await run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command",
        `Start-Process -FilePath '${file.replace(/'/g, "''")}' -Verb Print -WindowStyle Hidden`,
      ]);
    } else {
      const args = printerName ? ["-d", printerName, file] : [file];
      await run("lp", args);
    }
  } finally {
    setTimeout(() => { try { fs.unlinkSync(file); } catch { /* ignore */ } }, 10_000);
  }
}

async function printReceipt(payload) {
  const config = loadConfig();
  const printerName = payload.printerName || config.printerName || "";
  const text = payload.text || stripHtml(payload.html || "");

  if (text) {
    if (process.platform === "win32") await printTextWindows(text, printerName);
    else await printTextUnix(text, printerName);
    return { printerName: printerName || "default" };
  }

  if (payload.html) {
    await printHtmlFallback(payload.html, printerName);
    return { printerName: printerName || "default" };
  }

  throw new Error("Missing text or html");
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    const url = new URL(req.url || "/", `http://localhost:${PORT}`);

    if (req.method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, { success: true, config: loadConfig() });
    }

    if (req.method === "GET" && url.pathname === "/printers") {
      const printers = await listPrinters();
      return sendJson(res, 200, { success: true, printers, config: loadConfig() });
    }

    if (req.method === "POST" && url.pathname === "/config") {
      const body = await readBody(req);
      saveConfig({ printerName: body.printerName || "" });
      return sendJson(res, 200, { success: true, config: loadConfig() });
    }

    if (req.method === "POST" && url.pathname === "/print") {
      const body = await readBody(req);
      const result = await printReceipt(body);
      return sendJson(res, 200, { success: true, ...result });
    }

    return sendJson(res, 404, { success: false, message: "Not found" });
  } catch (err) {
    return sendJson(res, 500, { success: false, message: err && err.message ? err.message : String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const config = loadConfig();
  console.log(`Qubit QMS kiosk printer daemon: http://localhost:${PORT}`);
  console.log(`Printer: ${config.printerName || "default system printer"}`);
  console.log(`Config: ${CONFIG_FILE}`);
});
