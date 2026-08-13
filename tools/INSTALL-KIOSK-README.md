# Qubit Kiosk EXE — Install & Run

Quick steps to get the Windows EXE running on a kiosk machine.

1) Download the built EXE artifact (from CI or `dist/` produced by `electron-builder`).

2) Place `Qubit QMS Kiosk.exe` into a folder on the kiosk (e.g., `C:\Program Files\Qubit\kiosk`).

3) Create a `kiosk-config.json` next to the EXE with minimal settings:

```
{
  "kioskUrl": "https://your.site/kiosk?branch=<branchId>&device=<deviceId>",
  "printerName": "w80",
  "apiUrl": "https://your.site",
  "deviceId": "<deviceId>",
  "apiToken": "<optional_admin_token>",
  "fullscreen": true
}
```

4) Run the EXE to test:

```powershell
Start-Process -FilePath 'C:\Program Files\Qubit\kiosk\Qubit QMS Kiosk.exe'
```

5) To auto-start on login, use the provided PowerShell helper:

```powershell
cd C:\Path\To\Qubit\kiosk\tools
.\install-service.ps1 -ExePath 'C:\Program Files\Qubit\kiosk\Qubit QMS Kiosk.exe' -TaskName QubitKiosk
```

6) Verify the kiosk opens and that the menus update when the admin modifies the device settings in the backend.

If you need a true Windows Service, you can use NSSM (https://nssm.cc/) or SC.exe with a wrapper. The scheduled task approach keeps things simple and avoids extra dependencies.

CI / Building the template EXE
--------------------------------
If you prefer to generate the template EXE via CI (recommended), add a GitHub Actions job that runs on `windows-latest` and executes:

```yaml
- name: Build Windows EXE
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - name: Setup Node
      uses: actions/setup-node@v4
      with:
        node-version: 20
    - name: Install deps & build
      working-directory: ./queue_front
      run: |
        npm ci
        npm run build
        npm run electron:pack
    - name: Upload artifact
      uses: actions/upload-artifact@v4
      with:
        name: qubit-kiosk-exe
        path: ./queue_front/dist/**
```

After CI produces the EXE, place it on your server where the API can access it, for example:

```
/var/www/qms/templates/Qubit QMS Kiosk.exe
```

Or set environment variable `KIOSK_TEMPLATE_PATH` to the file path where the EXE lives.
