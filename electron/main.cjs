const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  kioskUrl: "https://xnavbat.polito.uz/kiosk?branch=bd59ca71-098f-4815-83f2-9b7e9f318ce8&device=5bb9ecc0-5f0d-4a86-9234-372c94f1bc6e",
  printerName: "w80",
  fullscreen: true,
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function loadConfig() {
  const bundled = readJson(path.join(__dirname, "kiosk-config.json"));
  const besideExe = readJson(path.join(path.dirname(process.execPath), "kiosk-config.json"));
  const userConfig = readJson(path.join(app.getPath("userData"), "kiosk-config.json"));
  const cli = {};
  for (const arg of process.argv.slice(1)) {
    if (arg.startsWith("--kiosk-url=")) cli.kioskUrl = arg.slice("--kiosk-url=".length);
    if (arg.startsWith("--printer=")) cli.printerName = arg.slice("--printer=".length);
    if (arg === "--windowed") cli.fullscreen = false;
    if (arg === "--fullscreen") cli.fullscreen = true;
  }
  return { ...DEFAULT_CONFIG, ...bundled, ...besideExe, ...userConfig, ...cli };
}

function copyDefaultConfig() {
  const target = path.join(app.getPath("userData"), "kiosk-config.json");
  if (fs.existsSync(target)) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(loadConfig(), null, 2));
}

function injectPrintBridge(win) {
  const script = `
(() => {
  if (!window.qubitKiosk || window.__qubitPrintBridgeInstalled) return;
  window.__qubitPrintBridgeInstalled = true;
  window.print = () => {
    const html = document.documentElement.outerHTML;
    window.qubitKiosk.printReceipt(html).catch((error) => {
      console.error("[kiosk print] Silent print failed.", error);
    });
  };
})();
`;
  win.webContents.executeJavaScript(script).catch(() => {});
}

function createWindow() {
  const config = loadConfig();
  copyDefaultConfig();
  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: Boolean(config.fullscreen),
    autoHideMenuBar: true,
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on("did-finish-load", () => injectPrintBridge(win));
  win.webContents.on("did-navigate", () => injectPrintBridge(win));
  win.webContents.on("did-navigate-in-page", () => injectPrintBridge(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    win.loadURL(url);
    return { action: "deny" };
  });

  win.loadURL(config.kioskUrl);

  // If configured with backend API + deviceId, fetch device settings and inject into page localStorage.
  if (config.apiUrl && config.deviceId) {
    (async () => {
      try {
        const _fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : require('node-fetch');
        const url = `${config.apiUrl.replace(/\/\/$/, '')}/api/v1/devices/${config.deviceId}`;
        const headers = {};
        if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
        const res = await _fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch device settings');
        const body = await res.json();
        const settings = body?.data?.settings ?? body?.data ?? {};
        // Write paired_device_<id> into localStorage and reload page so kiosk app picks up settings
        const script = `localStorage.setItem('paired_device_' + ${JSON.stringify(config.deviceId)}, JSON.stringify({ device: ${JSON.stringify(config.deviceId)}, settings: ${JSON.stringify(settings)} }));`;
        try { await win.webContents.executeJavaScript(script); } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('[kiosk] could not fetch device settings:', e && e.message);
      }
    })();
  }

  // Poll device settings periodically to detect admin changes and update kiosk view
  if (config.apiUrl && config.deviceId) {
    const pollInterval = (config.pollIntervalSeconds || 60) * 1000;
    let lastSettingsHash = null;
    setInterval(async () => {
      try {
        const _fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : require('node-fetch');
        const url = `${config.apiUrl.replace(/\/\/$/, '')}/api/v1/devices/${config.deviceId}`;
        const headers = {};
        if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
        const res = await _fetch(url, { headers });
        if (!res.ok) return;
        const body = await res.json();
        const settingsObj = body?.data?.settings ?? body?.data ?? {};
        const settings = JSON.stringify(settingsObj);
        const hash = require('crypto').createHash('sha1').update(settings).digest('hex');
        if (lastSettingsHash && hash !== lastSettingsHash) {
          // update localStorage and reload
          const script = `localStorage.setItem('paired_device_' + ${JSON.stringify(config.deviceId)}, JSON.stringify({ device: ${JSON.stringify(config.deviceId)}, settings: ${JSON.stringify(settingsObj)} }));`;
          try { await win.webContents.executeJavaScript(script); } catch (e) { /* ignore */ }
          try { win.reload(); } catch (e) { /* ignore */ }
        }
        lastSettingsHash = hash;
      } catch (e) {
        /* ignore polling errors */
      }
    }, pollInterval);
  }
}

ipcMain.handle("qubit:get-printers", async (event) => {
  return event.sender.getPrintersAsync();
});

ipcMain.handle("qubit:print-receipt", async (event, html) => {
  const config = loadConfig();

  const printWindow = new BrowserWindow({
    show: false,
    width: 360,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(String(html || ""))}`;
  await printWindow.loadURL(dataUrl);

  const printers = await printWindow.webContents.getPrintersAsync().catch(() => []);

  const doPrint = (options) =>
    new Promise((resolve, reject) => {
      printWindow.webContents.print(options, (success, failureReason) => {
        if (success) resolve(true);
        else reject(new Error(failureReason || "Print failed"));
      });
    });

  try {
    // If a specific printer is configured, prefer it. If it's not found or printing fails,
    // fall back to the system default (no deviceName).
    if (config.printerName) {
      const found = printers.find((p) => p.name === config.printerName || p.displayName === config.printerName);
      if (!found) {
        console.warn('[kiosk print] configured printer not found:', config.printerName, 'available:', printers.map(p=>p.name).join(', '));
      }

      try {
        await doPrint({
          silent: true,
          printBackground: true,
          deviceName: found ? config.printerName : undefined,
          margins: { marginType: "none" },
          pageSize: { width: 80000, height: 200000 },
        });
      } catch (err) {
        console.warn('[kiosk print] primary print failed, retrying with default printer:', err && err.message);
        await doPrint({ silent: true, printBackground: true, margins: { marginType: "none" }, pageSize: { width: 80000, height: 200000 } });
      }
    } else {
      await doPrint({ silent: true, printBackground: true, margins: { marginType: "none" }, pageSize: { width: 80000, height: 200000 } });
    }
  } finally {
    try { printWindow.close(); } catch {}
  }

  return { success: true, printers };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
