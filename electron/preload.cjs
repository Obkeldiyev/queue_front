const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("qubitKiosk", {
  printReceipt: (html) => ipcRenderer.invoke("qubit:print-receipt", html),
  getPrinters: () => ipcRenderer.invoke("qubit:get-printers"),
});
