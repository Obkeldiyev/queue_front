#!/usr/bin/env node
/*
  Simple local print daemon for kiosk machines.
  - POST /print { html: string } -> saves temporary HTML and prints via native spooler
  - Uses the optional `printer` npm package if installed for reliable cross-platform printing.
  - Usage: `node kiosk-printer-daemon.js --port 4020 --printer "EPSON WF-5620"`
*/
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const argv = require("minimist")(process.argv.slice(2));
const PORT = Number(argv.port || 4020);
const PRINTER_NAME = argv.printer || null;

let printerLib = null;
try {
  // optional native binding; install with `npm i printer`
  printerLib = require("printer");
} catch (e) {
  // not installed — we'll fall back to OS print commands
}

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));

function tmpFileName(ext) {
  return path.join(os.tmpdir(), `kiosk_print_${crypto.randomBytes(6).toString("hex")}.${ext}`);
}

function cleanup(file) {
  try { fs.unlinkSync(file); } catch (e) { /* ignore */ }
}

function printWithPrinterLib(file, printerName) {
  return new Promise((resolve, reject) => {
    try {
      printerLib.printFile({ filename: file, printer: printerName || undefined, success: function(jobID){ resolve(jobID); }, error: function(err){ reject(err); } });
    } catch (e) { reject(e); }
  });
}

function printWithPowerShell(file, printerName) {
  return new Promise((resolve, reject) => {
    // Use PowerShell Start-Process -Verb Print on Windows (may require default app handling)
    const args = ["-NoProfile", "-Command"];
    // Use Out-Printer for plain text, or use start-process print verb for files
    if (printerName) {
      // Use PowerShell's Start-Process to print to a specific printer (may open a window briefly depending on filetype)
      const cmd = `Start-Process -FilePath \"${file}\" -ArgumentList \"\" -Verb Print -PassThru | Out-Null`;
      args.push(cmd);
    } else {
      const cmd = `Start-Process -FilePath \"${file}\" -Verb Print -PassThru | Out-Null`;
      args.push(cmd);
    }
    const ps = spawn("powershell.exe", args, { windowsHide: true });
    ps.on("error", reject);
    ps.on("exit", (code) => { if (code === 0) resolve(true); else reject(new Error(`powershell exit ${code}`)); });
  });
}

function printWithLpr(file, printerName) {
  return new Promise((resolve, reject) => {
    const args = printerName ? ["-P", printerName, file] : [file];
    const lpr = spawn("lpr", args);
    lpr.on("error", reject);
    lpr.on("exit", (code) => { if (code === 0) resolve(true); else reject(new Error(`lpr exit ${code}`)); });
  });
}

app.post("/print", async (req, res) => {
  try {
    const { html } = req.body || {};
    if (!html) return res.status(400).json({ success: false, message: "Missing html" });

    const tmp = tmpFileName("html");
    fs.writeFileSync(tmp, html, "utf8");

    try {
      if (printerLib) {
        await printWithPrinterLib(tmp, PRINTER_NAME);
      } else if (process.platform === "win32") {
        await printWithPowerShell(tmp, PRINTER_NAME);
      } else {
        // try common *nix print command
        await printWithLpr(tmp, PRINTER_NAME);
      }
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false, message: String(e && e.message ? e.message : e) });
    } finally {
      // best-effort cleanup
      setTimeout(() => cleanup(tmp), 5_000);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, () => {
  console.log(`Kiosk print daemon listening on http://localhost:${PORT}/print`);
  if (PRINTER_NAME) console.log(`Target printer: ${PRINTER_NAME}`);
  if (!printerLib) console.log("Note: optional native 'printer' package not installed — daemon will use OS print commands.");
});
