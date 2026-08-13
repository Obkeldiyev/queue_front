# Qubit QMS Kiosk EXE

This Electron wrapper loads the deployed kiosk website and prints receipts silently through the Windows printer queue.

## Default Config

`electron/kiosk-config.json`

```json
{
  "kioskUrl": "https://xnavbat.polito.uz/kiosk?branch=bd59ca71-098f-4815-83f2-9b7e9f318ce8&device=5bb9ecc0-5f0d-4a86-9234-372c94f1bc6e",
  "printerName": "w80",
  "fullscreen": true
}
```

The printer name must match the Windows printer queue name. In your screenshot it is `w80`.

## Development Run

```bash
npm install
npm run electron
```

Override settings without editing files:

```bash
npm run electron -- --printer=w80 --windowed
```

## Build EXE

Portable EXE:

```bash
npm run electron:pack
```

Installer:

```bash
npm run electron:installer
```

Output files are created in `dist/`.

## Admin Setup

1. Install the Windows printer normally and name it `w80`.
2. Run the kiosk EXE.
3. Open the kiosk page inside the app.
4. When a ticket is created, the app prints silently to `w80`.

Normal Chrome and Edge tabs cannot silently print to a Windows printer queue. This EXE is the silent-printing path.
