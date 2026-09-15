const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const fs = require("fs");
const path = require("path");

let shuttingDown = false;
app.on("before-quit", () => {
  shuttingDown = true;
});
if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on("second-instance", () => {
  const w = BrowserWindow.getAllWindows()[0];
  if (w) {
    w.restore();
    w.focus();
  }
});

const DEFAULT_CONFIG = {
  kioskUrl:
    "https://xnavbat.polito.uz/kiosk?branch=bd59ca71-098f-4815-83f2-9b7e9f318ce8&device=5bb9ecc0-5f0d-4a86-9234-372c94f1bc6e",
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
  // Always overwrite userData config with the merged config so that the
  // kiosk-config.json placed beside the EXE always takes effect.
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
    kiosk: Boolean(config.fullscreen),
    autoHideMenuBar: true,
    // create a frameless window so standard window controls are not shown
    frame: false,
    // ensure the window cannot be minimized/maximized/closed via OS buttons
    minimizable: false,
    maximizable: false,
    closable: false,
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const origin = new URL(config.kioskUrl).origin;
  let retryTimer;
  const reload = () => {
    clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (!win.isDestroyed()) win.loadURL(config.kioskUrl).catch(() => {});
    }, 3000);
  };
  win.on("close", (e) => {
    if (config.fullscreen && !shuttingDown) e.preventDefault();
  });
  win.on("closed", () => clearTimeout(retryTimer));
  win.webContents.on("render-process-gone", reload);
  win.webContents.on("unresponsive", reload);
  win.webContents.on("did-fail-load", (_e, code, _desc, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) reload();
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (new URL(url).origin !== origin) e.preventDefault();
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (
      config.fullscreen &&
      (input.key === "Escape" ||
        input.key === "F11" ||
        input.key === "F12" ||
        input.alt ||
        ((input.control || input.meta) &&
          ["r", "w", "n", "t", "l", "q", "p"].includes(input.key.toLowerCase())))
    )
      e.preventDefault();
  });
  win.webContents.on("did-finish-load", () => injectPrintBridge(win));
  win.webContents.on("did-navigate", () => injectPrintBridge(win));
  win.webContents.on("did-navigate-in-page", () => injectPrintBridge(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin === origin) win.loadURL(url).catch(() => {});
    return { action: "deny" };
  });

  win.loadURL(config.kioskUrl).catch(reload);
  console.log("[kiosk] loadURL:", config.kioskUrl);

  // Open DevTools in windowed mode for debugging
  if (!config.fullscreen || process.argv.includes("--devtools")) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  // Log page errors to help diagnose socket/API issues
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("[kiosk] did-fail-load", errorCode, errorDescription, validatedURL);
  });
  win.webContents.on("console-message", (event, level, message) => {
    if (level >= 2) console.error("[kiosk page error]", message);
  });

  // If configured with backend API + deviceId, fetch device settings and inject into page localStorage.
  if (config.apiUrl && config.deviceId) {
    (async () => {
      try {
        const _fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : require("node-fetch");
        const url = `${config.apiUrl.replace(/\/\/$/, "")}/api/v1/devices/${config.deviceId}`;
        const headers = {};
        if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
        const res = await _fetch(url, { headers });
        if (!res.ok) throw new Error("Failed to fetch device settings");
        const body = await res.json();
        const settings = body?.data?.settings ?? body?.data ?? {};
        // Write paired_device_<id> into localStorage and reload page so kiosk app picks up settings
        const script = `localStorage.setItem('paired_device_' + ${JSON.stringify(config.deviceId)}, JSON.stringify({ device: ${JSON.stringify(config.deviceId)}, settings: ${JSON.stringify(settings)} }));`;
        try {
          await win.webContents.executeJavaScript(script);
        } catch (e) {
          /* ignore */
        }
      } catch (e) {
        console.warn("[kiosk] could not fetch device settings:", e && e.message);
      }
    })();
  }

  // Poll device settings periodically to detect admin changes and update kiosk view
  if (config.apiUrl && config.deviceId) {
    const pollInterval = (config.pollIntervalSeconds || 60) * 1000;
    let lastSettingsHash = null;
    setInterval(async () => {
      try {
        const _fetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : require("node-fetch");
        const url = `${config.apiUrl.replace(/\/\/$/, "")}/api/v1/devices/${config.deviceId}`;
        const headers = {};
        if (config.apiToken) headers.Authorization = `Bearer ${config.apiToken}`;
        const res = await _fetch(url, { headers });
        if (!res.ok) return;
        const body = await res.json();
        const settingsObj = body?.data?.settings ?? body?.data ?? {};
        const settings = JSON.stringify(settingsObj);
        const hash = require("crypto").createHash("sha1").update(settings).digest("hex");
        if (lastSettingsHash && hash !== lastSettingsHash) {
          // Update localStorage and fire a custom event so React can re-apply
          // settings (theme, etc.) without a disruptive full page reload.
          const script = `
            localStorage.setItem('paired_device_' + ${JSON.stringify(config.deviceId)}, JSON.stringify({ device: ${JSON.stringify(config.deviceId)}, settings: ${JSON.stringify(settingsObj)} }));
            window.dispatchEvent(new CustomEvent('qubit:settings-changed', { detail: { deviceId: ${JSON.stringify(config.deviceId)}, settings: ${JSON.stringify(settingsObj)} } }));
          `;
          try {
            await win.webContents.executeJavaScript(script);
          } catch (e) {
            /* ignore */
          }
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

  await printWindow.webContents.executeJavaScript(
    "Promise.all(Array.from(document.images).map(i => i.decode().catch(() => {})))",
  );
  const paper = String(html).match(/@page\s*\{\s*size:\s*([\d.]+)mm\s+([\d.]+)mm/);
  const pageSize = paper
    ? {
        width: Math.round(Math.max(20, Math.min(500, Number(paper[1]))) * 1000),
        height: Math.round(Math.max(20, Math.min(500, Number(paper[2]))) * 1000),
      }
    : { width: 80000, height: 150000 };
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
      const found = printers.find(
        (p) => p.name === config.printerName || p.displayName === config.printerName,
      );
      if (!found) {
        console.warn(
          "[kiosk print] configured printer not found:",
          config.printerName,
          "available:",
          printers.map((p) => p.name).join(", "),
        );
      }

      try {
        await doPrint({
          silent: true,
          printBackground: true,
          deviceName: found ? config.printerName : undefined,
          margins: { marginType: "none" },
          pageSize,
        });
      } catch (err) {
        console.warn(
          "[kiosk print] primary print failed, retrying with default printer:",
          err && err.message,
        );
        await doPrint({
          silent: true,
          printBackground: true,
          margins: { marginType: "none" },
          pageSize,
        });
      }
    } else {
      await doPrint({
        silent: true,
        printBackground: true,
        margins: { marginType: "none" },
        pageSize,
      });
    }
  } finally {
    try {
      printWindow.close();
    } catch {}
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
