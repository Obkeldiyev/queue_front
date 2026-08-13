const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qubitKiosk", {
  printReceipt: (html) => ipcRenderer.invoke("qubit:print-receipt", html),
  getPrinters: () => ipcRenderer.invoke("qubit:get-printers"),
});

// Override default window.print and block Ctrl/Cmd+P to prevent Chromium print preview.
// Run as early as possible so page scripts calling window.print() will be routed to the native print bridge.
try {
  // Ensure we set overrides before the page scripts execute where possible
  const attachOverrides = () => {
    try {
      // expose a safe print function on window that calls into our IPC bridge
      window.print = () => {
        try {
          // gather page HTML and invoke native silent print
          const html = document.documentElement ? document.documentElement.outerHTML : '';
          // fire-and-forget
          window.qubitKiosk?.printReceipt?.(html).catch(() => {});
        } catch (e) {}
      };

      // prevent default print shortcut (Ctrl/Cmd+P) and route to silent print
      window.addEventListener('keydown', (ev) => {
        const key = ev.key ? ev.key.toLowerCase() : '';
        if ((ev.ctrlKey || ev.metaKey) && key === 'p') {
          ev.preventDefault();
          try {
            const html = document.documentElement ? document.documentElement.outerHTML : '';
            window.qubitKiosk?.printReceipt?.(html).catch(() => {});
          } catch (e) {}
        }
      }, { capture: true, passive: false });

      // disable beforeprint handlers which may open preview
      try { window.onbeforeprint = null; } catch (e) {}
    } catch (e) {}
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') attachOverrides();
  else window.addEventListener('DOMContentLoaded', attachOverrides, { once: true });
} catch (e) {
  // swallow any preload errors
}
